import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sanctionsHit = Boolean(body.SANCTIONS_HIT || body.sanctionsHit);
    const pepAssociated = Boolean(body.PEP_ASSOCIATED || body.pepAssociated);
    const uboPepCount = Number(body.UBO_PEP_COUNT || 0);
    const uboSanctionsMatch = Number(body.UBO_SANCTIONS_MATCH_COUNT || 0);
    const countryRiskScore = Number(body.COUNTRY_RISK_SCORE || body.countryRiskScore || 0);
    const fatfStatus = String(body.FATF_STATUS || body.fatfStatus || 'NORMAL').toUpperCase();
    const patternRiskScore = Number(body.PATTERN_RISK_SCORE || body.patternRiskScore || 0);
    const amountUsd = Number(body.AMOUNT_USD || body.amountUsd || 0);
    const baselineTxCount = Number(body.BASELINE_TRANSACTION_COUNT || body.baselineTxCount || 1);
    const baselineAvgAmount = Number(body.BASELINE_AVG_AMOUNT || body.baselineAvgAmount || 0);
    const relationshipYears = Number(body.RELATIONSHIP_YEARS || body.relationshipYears || 0);
    const kycStatus = String(body.KYC_STATUS || body.kycStatus || 'UNVERIFIED').toUpperCase();
    const kycRiskRating = String(body.KYC_RISK_RATING || body.kycRiskRating || 'MEDIUM').toUpperCase();
    const requiresEdd = Boolean(body.REQUIRES_EDD || body.requiresEdd);
    const adverseMediaFlag = Boolean(body.ADVERSE_MEDIA_FLAG || body.adverseMediaFlag);
    const priorTruePositive = Boolean(body.PRIOR_TRUE_POSITIVE || body.priorTruePositive);
    const slaHoursLeft = Number(body.SLA_HOURS_LEFT || body.slaHoursLeft || 24.0);
    const alertAgeDays = Number(body.ALERT_AGE_DAYS || body.alertAgeDays || 1.0);

    const reasonCodes: any[] = [];

    // 1. Counterparty Factor (30 pts)
    let cpScore = 0;
    if (sanctionsHit || uboSanctionsMatch > 0) {
      cpScore += 30;
      reasonCodes.push({ code: 'RC-SANCTION-HIT', factor: 'COUNTERPARTY', points: 30, description: 'Sanctions match detected on entity or beneficial owner' });
    } else if (pepAssociated || uboPepCount > 0) {
      cpScore += 20;
      reasonCodes.push({ code: 'RC-PEP-MATCH', factor: 'COUNTERPARTY', points: 20, description: 'Politically Exposed Person (PEP) associated' });
    }

    // 2. Jurisdiction Factor (20 pts)
    let geoScore = 0;
    if (['HIGH_RISK', 'BLACK_LIST', 'GREY_LIST'].includes(fatfStatus)) {
      geoScore += 20;
      reasonCodes.push({ code: 'RC-FATF-JURISDICTION', factor: 'JURISDICTION', points: 20, description: 'High-risk FATF listed jurisdiction' });
    } else {
      geoScore += Math.min(20, (countryRiskScore / 100) * 20);
    }

    // 3. Structural Factor (20 pts)
    const structScore = Math.min(20, (patternRiskScore / 100) * 20);
    if (patternRiskScore > 50) {
      reasonCodes.push({ code: 'RC-PATTERN-ANOMALY', factor: 'STRUCTURAL', points: structScore, description: 'High transaction pattern anomaly detected' });
    }

    // 4. Exposure Factor (10 pts)
    const expScore = Math.min(10, (amountUsd / 500000) * 10);
    if (amountUsd >= 100000) {
      reasonCodes.push({ code: 'RC-HIGH-VALUE', factor: 'EXPOSURE', points: expScore, description: 'High-value transaction exceeding threshold' });
    }

    // 5. Behavioural Factor (5 pts)
    let behScore = 0;
    if (baselineTxCount >= 5 && baselineAvgAmount > 0 && amountUsd > baselineAvgAmount * 2.5) {
      behScore = 5;
      reasonCodes.push({ code: 'RC-BASELINE-DEVIATION', factor: 'BEHAVIOURAL', points: 5, description: 'Significant amount deviation from historical baseline' });
    }

    // 7. Data Integrity Factor (15 pts) & Confidence calculation
    const requiredFields = ['LEGAL_NAME', 'INCORPORATION_COUNTRY_ID', 'KYC_STATUS', 'AMOUNT_USD'];
    let knownCount = 0;
    for (const f of requiredFields) {
      if (body[f] !== undefined && body[f] !== null && String(body[f]).trim() !== '') {
        knownCount++;
      }
    }
    const evidenceConfidence = Number((knownCount / requiredFields.length).toFixed(2));
    const diScore = (1 - evidenceConfidence) * 15;

    const riskScore = Number(Math.min(100, cpScore + geoScore + structScore + expScore + behScore + diScore).toFixed(2));
    const riskTier = riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW';

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
    let assignedQueue = 'STANDARD';
    if (autoClearEligible) {
      assignedQueue = 'AUTO_CLEAR';
    } else if (evidenceConfidence < 0.6) {
      assignedQueue = 'DATA_CHASE';
    } else if (sanctionsHit || pepAssociated || (riskTier === 'HIGH' && evidenceConfidence >= 0.8)) {
      assignedQueue = 'ESCALATE';
    }

    // Queue Score Formula: queue_score = w1*(SLA_breach_urgency) + w2*(COMPOSITE_RISK_SCORE) + w3*(regulatory_exposure_proxy) + w4*(alert_age)
    const slaUrgency = Math.max(0, (48 - slaHoursLeft) / 48) * 100;
    const regExposureProxy = (sanctionsHit || pepAssociated || ['HIGH_RISK', 'BLACK_LIST'].includes(fatfStatus)) ? 100 : 0;
    const alertAgeScore = Math.min(100, alertAgeDays * 10);
    const queueScore = Number((0.35 * slaUrgency + 0.30 * riskScore + 0.25 * regExposureProxy + 0.10 * alertAgeScore).toFixed(2));

    return NextResponse.json({
      weight_version: 'v2.0-draft',
      risk_score: riskScore,
      risk_tier: riskTier,
      evidence_confidence: evidenceConfidence,
      auto_clear_eligible: autoClearEligible,
      assigned_queue: assignedQueue,
      queue_score: queueScore,
      reason_codes: reasonCodes
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal v2 scoring error' }, { status: 500 });
  }
}
