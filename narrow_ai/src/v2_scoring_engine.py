"""
v2 Scoring & Triage Engine (SCALE 2026 / RiskSignal)
Weight Version: v2.0-draft
Supersedes v1-plan.md according to empirical discovery findings.
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Any

WEIGHT_VERSION = "v2.0-draft"

# v2 Typology-Derived Factor Weights (Total = 100)
FACTOR_WEIGHTS = {
    "COUNTERPARTY": 30.0,
    "JURISDICTION": 20.0,
    "STRUCTURAL": 20.0,
    "EXPOSURE": 10.0,
    "BEHAVIOURAL": 5.0,
    "DATA_INTEGRITY": 15.0,
    "VELOCITY": 0.0  # Retired due to 15.4 vs 15.4 zero separation
}


def calculate_v2_risk_score(record: Dict[str, Any]) -> Dict[str, Any]:
    reason_codes = []
    evidence_ids = []

    # 1. Counterparty Risk Factor (Weight: 30)
    sanctions_hit = bool(record.get('SANCTIONS_HIT', False))
    pep_associated = bool(record.get('PEP_ASSOCIATED', False))
    ubo_pep_count = int(record.get('UBO_PEP_COUNT', 0))
    ubo_sanctions_match = int(record.get('UBO_SANCTIONS_MATCH_COUNT', 0))

    cp_score = 0.0
    if sanctions_hit or ubo_sanctions_match > 0:
        cp_score += 30.0
        reason_codes.append({"code": "RC-SANCTION-HIT", "factor": "COUNTERPARTY", "points": 30.0, "description": "Sanctions match detected on entity or beneficial owner"})
    elif pep_associated or ubo_pep_count > 0:
        cp_score += 20.0
        reason_codes.append({"code": "RC-PEP-MATCH", "factor": "COUNTERPARTY", "points": 20.0, "description": "Politically Exposed Person (PEP) associated"})

    # 2. Jurisdiction / Geography Risk Factor (Weight: 20)
    fatf_status = str(record.get('FATF_STATUS', 'NORMAL')).upper()
    country_risk_score = float(record.get('COUNTRY_RISK_SCORE', 0.0))

    geo_score = 0.0
    if fatf_status in ['HIGH_RISK', 'BLACK_LIST', 'GREY_LIST']:
        geo_score += 20.0
        reason_codes.append({"code": "RC-FATF-JURISDICTION", "factor": "JURISDICTION", "points": 20.0, "description": "High-risk FATF listed jurisdiction"})
    else:
        geo_score += min(20.0, (country_risk_score / 100.0) * 20.0)

    # 3. Structural Risk Factor (Weight: 20)
    pattern_risk_score = float(record.get('PATTERN_RISK_SCORE', 0.0))
    struct_score = min(20.0, (pattern_risk_score / 100.0) * 20.0)
    if pattern_risk_score > 50.0:
        reason_codes.append({"code": "RC-PATTERN-ANOMALY", "factor": "STRUCTURAL", "points": struct_score, "description": "High transaction pattern anomaly detected"})

    # 4. Exposure Risk Factor (Weight: 10)
    amount_usd = float(record.get('AMOUNT_USD', 0.0))
    exp_score = min(10.0, (amount_usd / 500000.0) * 10.0)
    if amount_usd >= 100000.0:
        reason_codes.append({"code": "RC-HIGH-VALUE", "factor": "EXPOSURE", "points": exp_score, "description": "High-value transaction exceeding threshold"})

    # 5. Behavioural Baseline Risk Factor (Weight: 5)
    baseline_tx_count = int(record.get('BASELINE_TRANSACTION_COUNT', 1))
    beh_score = 0.0
    if baseline_tx_count >= 5:
        avg_amount = float(record.get('BASELINE_AVG_AMOUNT', 0.0))
        if avg_amount > 0 and amount_usd > (avg_amount * 2.5):
            beh_score = 5.0
            reason_codes.append({"code": "RC-BASELINE-DEVIATION", "factor": "BEHAVIOURAL", "points": 5.0, "description": "Significant amount deviation from historical baseline"})

    # 6. Velocity Risk Factor (Weight: 0 - Retired)
    # Logged as 0 points per v2 plan evidence (15.4 vs 15.4 zero separation)

    # 7. Data Integrity Factor (Weight: 15)
    required_fields = ['LEGAL_NAME', 'INCORPORATION_COUNTRY_ID', 'KYC_STATUS', 'AMOUNT_USD']
    missing_fields = [f for f in required_fields if record.get(f) is None or str(record.get(f)).strip() in ['', 'nan', 'None', 'NULL']]

    known_count = len(required_fields) - len(missing_fields)
    evidence_confidence = round(known_count / float(len(required_fields)), 2)

    di_score = (1.0 - evidence_confidence) * 15.0
    if len(missing_fields) > 0:
        reason_codes.append({"code": "RC-DATA-MISSING", "factor": "DATA_INTEGRITY", "points": di_score, "description": f"Missing mandatory fields: {', '.join(missing_fields)}"})

    # Composite Risk Score Calculation
    total_risk_score = round(min(100.0, cp_score + geo_score + struct_score + exp_score + beh_score + di_score), 2)

    # Risk Tier Assignment
    if total_risk_score >= 60.0:
        risk_tier = "HIGH"
    elif total_risk_score >= 30.0:
        risk_tier = "MEDIUM"
    else:
        risk_tier = "LOW"

    # Evaluate §3.1 Auto-Clear Eligibility
    relationship_years = float(record.get('RELATIONSHIP_YEARS', 0.0))
    kyc_status = str(record.get('KYC_STATUS', '')).upper()
    kyc_risk = str(record.get('KYC_RISK_RATING', '')).upper()
    requires_edd = bool(record.get('REQUIRES_EDD', False))
    adverse_media = bool(record.get('ADVERSE_MEDIA_FLAG', False))
    prior_tp = bool(record.get('PRIOR_TRUE_POSITIVE', False))

    auto_clear_eligible = (
        relationship_years >= 2.0 and
        kyc_risk == "LOW" and
        kyc_status == "VERIFIED" and
        not sanctions_hit and
        not pep_associated and
        not adverse_media and
        ubo_pep_count == 0 and
        ubo_sanctions_match == 0 and
        not requires_edd and
        evidence_confidence >= 0.8 and
        not prior_tp
    )

    # Evaluate Queue Routing (§3.2)
    if auto_clear_eligible:
        queue = "AUTO_CLEAR"
    elif evidence_confidence < 0.6:
        queue = "DATA_CHASE"
    elif sanctions_hit or pep_associated or (risk_tier == "HIGH" and evidence_confidence >= 0.8):
        queue = "ESCALATE"
    else:
        queue = "STANDARD"

    # Compute Multi-Factor Queue Ranking Score
    # queue_score = w1*(SLA_breach_urgency) + w2*(COMPOSITE_RISK_SCORE) + w3*(regulatory_exposure_proxy) + w4*(alert_age)
    sla_hours_left = float(record.get('SLA_HOURS_LEFT', 24.0))
    sla_urgency = max(0.0, (48.0 - sla_hours_left) / 48.0) * 100.0

    reg_exposure_proxy = 100.0 if (sanctions_hit or pep_associated or fatf_status in ['HIGH_RISK', 'BLACK_LIST']) else 0.0
    alert_age_days = float(record.get('ALERT_AGE_DAYS', 1.0))
    alert_age_score = min(100.0, alert_age_days * 10.0)

    w1, w2, w3, w4 = 0.35, 0.30, 0.25, 0.10
    queue_score = round(w1 * sla_urgency + w2 * total_risk_score + w3 * reg_exposure_proxy + w4 * alert_age_score, 2)

    return {
        "weight_version": WEIGHT_VERSION,
        "risk_score": total_risk_score,
        "risk_tier": risk_tier,
        "evidence_confidence": evidence_confidence,
        "auto_clear_eligible": auto_clear_eligible,
        "assigned_queue": queue,
        "queue_score": queue_score,
        "reason_codes": reason_codes
    }


if __name__ == '__main__':
    test_record = {
        "LEGAL_NAME": "Acme Global Trading Ltd",
        "INCORPORATION_COUNTRY_ID": 12,
        "KYC_STATUS": "VERIFIED",
        "KYC_RISK_RATING": "LOW",
        "RELATIONSHIP_YEARS": 3.5,
        "AMOUNT_USD": 450000.0,
        "SANCTIONS_HIT": False,
        "PEP_ASSOCIATED": False,
        "UBO_PEP_COUNT": 0,
        "UBO_SANCTIONS_MATCH_COUNT": 0,
        "FATF_STATUS": "NORMAL",
        "COUNTRY_RISK_SCORE": 15.0,
        "PATTERN_RISK_SCORE": 25.0,
        "BASELINE_TRANSACTION_COUNT": 10,
        "BASELINE_AVG_AMOUNT": 100000.0,
        "SLA_HOURS_LEFT": 12.0,
        "ALERT_AGE_DAYS": 2.0
    }

    result = calculate_v2_risk_score(test_record)
    print("v2 Scoring Engine Output:")
    print(json.dumps(result, indent=2))
