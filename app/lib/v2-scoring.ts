// TypeScript mirror of narrow_ai/src/v2_scoring_engine.py (WEIGHT_VERSION "v2.0-draft").
// Keep this in lockstep with the Python engine — tests/scoring-parity.test.mjs checks it.

export interface ReasonCode {
  code: string;
  factor: string;
  points: number;
  description: string;
}

export interface V2ScoringResult {
  weight_version: string;
  risk_score: number;
  risk_tier: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence_confidence: number;
  auto_clear_eligible: boolean;
  assigned_queue: 'AUTO_CLEAR' | 'DATA_CHASE' | 'ESCALATE' | 'STANDARD';
  queue_score: number;
  reason_codes: ReasonCode[];
}

const MISSING_STRING_VALUES = new Set(['', 'nan', 'None', 'NULL']);

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return MISSING_STRING_VALUES.has(String(value).trim());
}

export function calculateV2RiskScore(record: Record<string, unknown>): V2ScoringResult {
  const reasonCodes: ReasonCode[] = [];

  const sanctionsHit = Boolean(record.SANCTIONS_HIT ?? false);
  const pepAssociated = Boolean(record.PEP_ASSOCIATED ?? false);
  const uboPepCount = Number(record.UBO_PEP_COUNT ?? 0);
  const uboSanctionsMatch = Number(record.UBO_SANCTIONS_MATCH_COUNT ?? 0);
  const countryRiskScore = Number(record.COUNTRY_RISK_SCORE ?? 0);
  const fatfStatus = String(record.FATF_STATUS ?? 'NORMAL').toUpperCase();
  const patternRiskScore = Number(record.PATTERN_RISK_SCORE ?? 0);
  const amountUsd = Number(record.AMOUNT_USD ?? 0);
  const baselineTxCount = Number(record.BASELINE_TRANSACTION_COUNT ?? 1);
  const baselineAvgAmount = Number(record.BASELINE_AVG_AMOUNT ?? 0);
  const relationshipYears = Number(record.RELATIONSHIP_YEARS ?? 0);
  const kycStatus = String(record.KYC_STATUS ?? '').toUpperCase();
  const kycRiskRating = String(record.KYC_RISK_RATING ?? '').toUpperCase();
  const requiresEdd = Boolean(record.REQUIRES_EDD ?? false);
  const adverseMediaFlag = Boolean(record.ADVERSE_MEDIA_FLAG ?? false);
  const priorTruePositive = Boolean(record.PRIOR_TRUE_POSITIVE ?? false);
  const slaHoursLeft = Number(record.SLA_HOURS_LEFT ?? 24.0);
  const alertAgeDays = Number(record.ALERT_AGE_DAYS ?? 1.0);

  // 1. Counterparty Risk Factor (Weight: 30)
  let cpScore = 0;
  if (sanctionsHit || uboSanctionsMatch > 0) {
    cpScore += 30;
    reasonCodes.push({ code: 'RC-SANCTION-HIT', factor: 'COUNTERPARTY', points: 30, description: 'Sanctions match detected on entity or beneficial owner' });
  } else if (pepAssociated || uboPepCount > 0) {
    cpScore += 20;
    reasonCodes.push({ code: 'RC-PEP-MATCH', factor: 'COUNTERPARTY', points: 20, description: 'Politically Exposed Person (PEP) associated' });
  }

  // 2. Jurisdiction / Geography Risk Factor (Weight: 20)
  let geoScore = 0;
  if (['HIGH_RISK', 'BLACK_LIST', 'GREY_LIST'].includes(fatfStatus)) {
    geoScore += 20;
    reasonCodes.push({ code: 'RC-FATF-JURISDICTION', factor: 'JURISDICTION', points: 20, description: 'High-risk FATF listed jurisdiction' });
  } else {
    geoScore += Math.min(20, (countryRiskScore / 100) * 20);
  }

  // 3. Structural Risk Factor (Weight: 20)
  const structScore = Math.min(20, (patternRiskScore / 100) * 20);
  if (patternRiskScore > 50) {
    reasonCodes.push({ code: 'RC-PATTERN-ANOMALY', factor: 'STRUCTURAL', points: structScore, description: 'High transaction pattern anomaly detected' });
  }

  // 4. Exposure Risk Factor (Weight: 10)
  const expScore = Math.min(10, (amountUsd / 500000) * 10);
  if (amountUsd >= 100000) {
    reasonCodes.push({ code: 'RC-HIGH-VALUE', factor: 'EXPOSURE', points: expScore, description: 'High-value transaction exceeding threshold' });
  }

  // 5. Behavioural Baseline Risk Factor (Weight: 5)
  let behScore = 0;
  if (baselineTxCount >= 5 && baselineAvgAmount > 0 && amountUsd > baselineAvgAmount * 2.5) {
    behScore = 5;
    reasonCodes.push({ code: 'RC-BASELINE-DEVIATION', factor: 'BEHAVIOURAL', points: 5, description: 'Significant amount deviation from historical baseline' });
  }

  // 6. Velocity Risk Factor (Weight: 0 - Retired)

  // 7. Data Integrity Factor (Weight: 15)
  const requiredFields = ['LEGAL_NAME', 'INCORPORATION_COUNTRY_ID', 'KYC_STATUS', 'AMOUNT_USD'];
  const missingFields = requiredFields.filter((f) => isMissing(record[f]));
  const knownCount = requiredFields.length - missingFields.length;
  const evidenceConfidence = Number((knownCount / requiredFields.length).toFixed(2));
  const diScore = (1 - evidenceConfidence) * 15;
  if (missingFields.length > 0) {
    reasonCodes.push({ code: 'RC-DATA-MISSING', factor: 'DATA_INTEGRITY', points: diScore, description: `Missing mandatory fields: ${missingFields.join(', ')}` });
  }

  const riskScore = Number(Math.min(100, cpScore + geoScore + structScore + expScore + behScore + diScore).toFixed(2));
  const riskTier: V2ScoringResult['risk_tier'] = riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW';

  // Auto-clear Eligibility (§3.1)
  const autoClearEligible = (
    relationshipYears >= 2.0 &&
    kycRiskRating === 'LOW' &&
    kycStatus === 'VERIFIED' &&
    !sanctionsHit &&
    !pepAssociated &&
    !adverseMediaFlag &&
    uboPepCount === 0 &&
    uboSanctionsMatch === 0 &&
    !requiresEdd &&
    evidenceConfidence >= 0.8 &&
    !priorTruePositive
  );

  // Queue Routing (§3.2)
  let assignedQueue: V2ScoringResult['assigned_queue'] = 'STANDARD';
  if (autoClearEligible) {
    assignedQueue = 'AUTO_CLEAR';
  } else if (evidenceConfidence < 0.6) {
    assignedQueue = 'DATA_CHASE';
  } else if (sanctionsHit || pepAssociated || (riskTier === 'HIGH' && evidenceConfidence >= 0.8)) {
    assignedQueue = 'ESCALATE';
  }

  // Multi-Factor Queue Ranking Score
  const slaUrgency = Math.max(0, (48 - slaHoursLeft) / 48) * 100;
  const regExposureProxy = (sanctionsHit || pepAssociated || ['HIGH_RISK', 'BLACK_LIST'].includes(fatfStatus)) ? 100 : 0;
  const alertAgeScore = Math.min(100, alertAgeDays * 10);
  const queueScore = Number((0.35 * slaUrgency + 0.30 * riskScore + 0.25 * regExposureProxy + 0.10 * alertAgeScore).toFixed(2));

  return {
    weight_version: 'v2.0-draft',
    risk_score: riskScore,
    risk_tier: riskTier,
    evidence_confidence: evidenceConfidence,
    auto_clear_eligible: autoClearEligible,
    assigned_queue: assignedQueue,
    queue_score: queueScore,
    reason_codes: reasonCodes,
  };
}
