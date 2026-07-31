#!/usr/bin/env python
"""Build data/cases.json and data/scoring-parity-fixture.json from datasets/*.csv.

Every case is scored by Ian's v2 scoring engine (narrow_ai/src/v2_scoring_engine.py) —
that stays the single source of truth for risk_score/risk_tier/assigned_queue/reason_codes.
This script only adds two things the engine doesn't return: a per-factor points breakdown
(factor_scores) and the queue_score term breakdown, both computed here by mirroring the
engine's own simple formulas against the exact same input record, plus the priority
cascade (P1 closed -> P2 regulatory -> P3 overdue -> P4 medium -> P5 low).
"""
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "narrow_ai" / "src"))
from v2_scoring_engine import calculate_v2_risk_score, FACTOR_WEIGHTS, WEIGHT_VERSION  # noqa: E402

DATASETS = ROOT / "datasets"
OUT_DIR = ROOT / "data"
AS_OF = datetime(2026, 7, 30, 17, 7, 0)  # pinned to the dataset export stamp

QUEUE_WEIGHTS = {"slaUrgency": 0.35, "riskScore": 0.30, "regExposure": 0.25, "alertAge": 0.10}
REQUIRED_FIELDS = ["LEGAL_NAME", "INCORPORATION_COUNTRY_ID", "KYC_STATUS", "AMOUNT_USD"]
MISSING_STRINGS = {"", "nan", "None", "NULL"}


def _csv(name, **kwargs):
    matches = sorted(DATASETS.glob(f"{name}_*.csv"))
    if not matches:
        raise FileNotFoundError(f"No file matching '{name}_*.csv' in {DATASETS}")
    if len(matches) > 1:
        raise FileNotFoundError(f"Multiple files match '{name}_*.csv' in {DATASETS}: {[m.name for m in matches]}")
    return pd.read_csv(matches[0], **kwargs)


def _isna(v):
    try:
        return bool(pd.isna(v))
    except (TypeError, ValueError):
        return False


def clean(d: dict) -> dict:
    """Drop NaN-valued keys (so the engine's record.get(..., default) fires) and
    convert numpy/pandas scalars to native Python types (so the dict is JSON-safe)."""
    out = {}
    for k, v in d.items():
        if _isna(v):
            continue
        if isinstance(v, np.bool_):
            v = bool(v)
        elif isinstance(v, np.integer):
            v = int(v)
        elif isinstance(v, np.floating):
            v = float(v)
        elif isinstance(v, pd.Timestamp):
            v = v.isoformat()
        out[k] = v
    return out


def factor_scores(r: dict) -> dict:
    """Per-factor earned points, mirroring the engine's arithmetic (which the engine
    itself doesn't return — only the total). Used for the modal's "why this score" bars."""
    sanctions_hit = bool(r.get("SANCTIONS_HIT", False))
    pep = bool(r.get("PEP_ASSOCIATED", False))
    ubo_pep = int(r.get("UBO_PEP_COUNT", 0))
    ubo_sanctions = int(r.get("UBO_SANCTIONS_MATCH_COUNT", 0))
    cp = 30.0 if (sanctions_hit or ubo_sanctions > 0) else (20.0 if (pep or ubo_pep > 0) else 0.0)

    fatf = str(r.get("FATF_STATUS", "NORMAL")).upper()
    country_risk = float(r.get("COUNTRY_RISK_SCORE", 0.0))
    geo = 20.0 if fatf in ("HIGH_RISK", "BLACK_LIST", "GREY_LIST") else min(20.0, (country_risk / 100.0) * 20.0)

    pattern = float(r.get("PATTERN_RISK_SCORE", 0.0))
    struct = min(20.0, (pattern / 100.0) * 20.0)

    amount = float(r.get("AMOUNT_USD", 0.0))
    exp = min(10.0, (amount / 500000.0) * 10.0)

    baseline_count = int(r.get("BASELINE_TRANSACTION_COUNT", 1))
    beh = 0.0
    if baseline_count >= 5:
        avg = float(r.get("BASELINE_AVG_AMOUNT", 0.0))
        if avg > 0 and amount > avg * 2.5:
            beh = 5.0

    missing = [f for f in REQUIRED_FIELDS if r.get(f) is None or str(r.get(f)).strip() in MISSING_STRINGS]
    confidence = round((len(REQUIRED_FIELDS) - len(missing)) / len(REQUIRED_FIELDS), 2)
    di = round((1.0 - confidence) * 15.0, 2)

    return {
        "COUNTERPARTY": round(cp, 2),
        "JURISDICTION": round(geo, 2),
        "STRUCTURAL": round(struct, 2),
        "EXPOSURE": round(exp, 2),
        "BEHAVIOURAL": round(beh, 2),
        "DATA_INTEGRITY": di,
    }


def queue_terms(r: dict, risk_score: float) -> dict:
    sla_hours_left = float(r.get("SLA_HOURS_LEFT", 24.0))
    sla_urgency = round(max(0.0, (48.0 - sla_hours_left) / 48.0) * 100.0, 2)
    sanctions_hit = bool(r.get("SANCTIONS_HIT", False))
    pep = bool(r.get("PEP_ASSOCIATED", False))
    fatf = str(r.get("FATF_STATUS", "NORMAL")).upper()
    reg_exposure = 100.0 if (sanctions_hit or pep or fatf in ("HIGH_RISK", "BLACK_LIST")) else 0.0
    alert_age_days = float(r.get("ALERT_AGE_DAYS", 1.0))
    alert_age_score = round(min(100.0, alert_age_days * 10.0), 2)
    return {"slaUrgency": sla_urgency, "riskScore": risk_score, "regExposure": reg_exposure, "alertAge": alert_age_score}


def derive_priority(case_status: str, r: dict, result: dict, sla_breached: bool) -> str:
    """P1 closed -> P2 regulatory -> P3 overdue -> P4 medium -> P5 low, first match wins."""
    if case_status == "CLOSED":
        return "closed"

    sanctions_hit = bool(r.get("SANCTIONS_HIT", False))
    pep = bool(r.get("PEP_ASSOCIATED", False))
    ubo_sanctions = int(r.get("UBO_SANCTIONS_MATCH_COUNT", 0))
    ubo_pep = int(r.get("UBO_PEP_COUNT", 0))
    fatf = str(r.get("FATF_STATUS", "NORMAL")).upper()
    if sanctions_hit or pep or ubo_sanctions > 0 or ubo_pep > 0 or fatf in ("HIGH_RISK", "BLACK_LIST", "GREY_LIST"):
        return "regulatory"

    if sla_breached:
        return "overdue"

    # Reachable max of queue_score here is 0.35*100 + 0.30*100 + 0.10*100 = 75
    # (P2 already guaranteed reg_exposure=0, P3 guaranteed sla_urgency<100).
    attention_score = result["queue_score"] / 0.75
    if result["risk_tier"] != "LOW" or result["assigned_queue"] == "DATA_CHASE" or attention_score >= 60:
        return "medium"

    return "low"


def load():
    cases = _csv("COMPLIANCE_CASES")
    for col in ("OPENED_AT", "DUE_DATE", "CLOSED_AT", "UPDATED_AT"):
        cases[col] = pd.to_datetime(cases[col])

    case_alerts = _csv("CASE_ALERTS", usecols=["CASE_ID", "ALERT_ID", "LINKED_AT"])
    case_alerts["LINKED_AT"] = pd.to_datetime(case_alerts["LINKED_AT"])
    case_alerts = case_alerts.sort_values("LINKED_AT").drop_duplicates("CASE_ID", keep="last")

    # COMPLIANCE_CASES.OPENED_AT/DUE_DATE/CREATED_AT are a single constant timestamp
    # across all 500 rows (a batch-generation artifact, verified against the raw CSV) -
    # unusable as an SLA/age signal. RISK_ALERTS has real per-row timestamps, so SLA
    # urgency and alert age are sourced from there instead; see the per-row loop below.
    risk_alerts = _csv("RISK_ALERTS", usecols=["ALERT_ID", "TRANSACTION_ID", "ASSIGNED_TO", "CREATED_AT", "SLA_DUE_AT", "SLA_BREACHED"])
    risk_alerts["CREATED_AT"] = pd.to_datetime(risk_alerts["CREATED_AT"])
    risk_alerts["SLA_DUE_AT"] = pd.to_datetime(risk_alerts["SLA_DUE_AT"])
    risk_alerts = risk_alerts.rename(columns={"CREATED_AT": "ALERT_CREATED_AT"})

    transactions = _csv("TRANSACTIONS", usecols=["TRANSACTION_ID", "AMOUNT_USD"])

    trs = _csv("TRANSACTION_RISK_SCORES", usecols=["TRANSACTION_ID", "PATTERN_RISK_SCORE", "SCORED_AT"])
    trs["SCORED_AT"] = pd.to_datetime(trs["SCORED_AT"])
    trs = trs.sort_values("SCORED_AT").drop_duplicates("TRANSACTION_ID", keep="last")
    trs = trs[["TRANSACTION_ID", "PATTERN_RISK_SCORE"]]

    companies = _csv("COMPANIES", usecols=[
        "COMPANY_ID", "LEGAL_NAME", "INCORPORATION_COUNTRY_ID", "KYC_STATUS", "KYC_RISK_RATING",
        "PEP_ASSOCIATED", "SANCTIONS_HIT", "ADVERSE_MEDIA_FLAG", "RELATIONSHIP_START_DATE",
    ])
    companies["RELATIONSHIP_START_DATE"] = pd.to_datetime(companies["RELATIONSHIP_START_DATE"])

    risk_profiles = _csv("COMPANY_RISK_PROFILES", usecols=["COMPANY_ID", "COUNTRY_RISK_SCORE", "REQUIRES_EDD"])

    countries = _csv("COUNTRIES", usecols=["COUNTRY_ID", "FATF_STATUS"])

    owners = _csv("COMPANY_BENEFICIAL_OWNERS", usecols=["COMPANY_ID", "IS_PEP", "SANCTIONS_MATCH"])
    ubo = owners.groupby("COMPANY_ID").agg(
        UBO_PEP_COUNT=("IS_PEP", "sum"), UBO_SANCTIONS_MATCH_COUNT=("SANCTIONS_MATCH", "sum")
    ).reset_index()

    baselines = _csv("TRANSACTION_BASELINES", usecols=["COMPANY_ID", "TRANSACTION_COUNT", "AVG_AMOUNT_USD", "CALCULATED_AT"])
    baselines["CALCULATED_AT"] = pd.to_datetime(baselines["CALCULATED_AT"])
    baselines = baselines.sort_values("CALCULATED_AT").drop_duplicates("COMPANY_ID", keep="last")
    baselines = baselines.rename(columns={
        "TRANSACTION_COUNT": "BASELINE_TRANSACTION_COUNT", "AVG_AMOUNT_USD": "BASELINE_AVG_AMOUNT",
    })[["COMPANY_ID", "BASELINE_TRANSACTION_COUNT", "BASELINE_AVG_AMOUNT"]]

    joule = _csv("JOULE_EXPLANATIONS", usecols=["ALERT_ID", "EXPLANATION_TYPE", "EXPLANATION_TEXT", "GENERATED_AT"])
    joule["GENERATED_AT"] = pd.to_datetime(joule["GENERATED_AT"])
    joule = joule.sort_values("GENERATED_AT").drop_duplicates(["ALERT_ID", "EXPLANATION_TYPE"], keep="last")
    joule_by_alert = {}
    for alert_id, grp in joule.groupby("ALERT_ID"):
        joule_by_alert[int(alert_id)] = dict(zip(grp["EXPLANATION_TYPE"], grp["EXPLANATION_TEXT"]))

    cases = cases.merge(case_alerts, on="CASE_ID", how="left")
    cases = cases.merge(risk_alerts, on="ALERT_ID", how="left")
    cases = cases.merge(transactions, on="TRANSACTION_ID", how="left")
    cases = cases.merge(trs, on="TRANSACTION_ID", how="left")
    cases = cases.merge(companies, on="COMPANY_ID", how="left")
    cases = cases.merge(risk_profiles, on="COMPANY_ID", how="left")
    cases = cases.merge(countries, left_on="INCORPORATION_COUNTRY_ID", right_on="COUNTRY_ID", how="left")
    cases = cases.merge(ubo, on="COMPANY_ID", how="left")
    cases = cases.merge(baselines, on="COMPANY_ID", how="left")

    return cases, joule_by_alert


def build():
    cases, joule_by_alert = load()
    records = []

    for _, row in cases.iterrows():
        opened_at = row["OPENED_AT"]
        due_date = row["DUE_DATE"]
        has_alert = pd.notna(row.get("ALERT_ID"))

        amount_usd = row["AMOUNT_USD"] if pd.notna(row.get("AMOUNT_USD")) else row["TOTAL_FLAGGED_AMOUNT"]
        pattern_risk_score = float(row["PATTERN_RISK_SCORE"]) if has_alert and pd.notna(row.get("PATTERN_RISK_SCORE")) else 0.0

        # SLA/age signals: RISK_ALERTS.SLA_BREACHED is the dataset's own ground-truth
        # breach flag (real per-row split); we don't have a compatible "now" to derive
        # our own live countdown against SLA_DUE_AT (it predates AS_OF for ~every
        # alert), so breached -> 0h left (max urgency), else -> the alert's own SLA
        # window (SLA_DUE_AT - CREATED_AT), clamped to keep the engine's uncapped
        # sla_urgency formula in a sane 0-100 range. No alert -> omit, engine default.
        sla_breached = False
        sla_hours_left = None
        alert_age_days = None
        if has_alert:
            sla_breached = bool(row.get("SLA_BREACHED", False))
            if sla_breached:
                sla_hours_left = 0.0
            elif pd.notna(row.get("SLA_DUE_AT")) and pd.notna(row.get("ALERT_CREATED_AT")):
                window_hours = (row["SLA_DUE_AT"] - row["ALERT_CREATED_AT"]).total_seconds() / 3600.0
                sla_hours_left = max(1.0, min(48.0, window_hours))
            if pd.notna(row.get("ALERT_CREATED_AT")):
                alert_age_days = (AS_OF - row["ALERT_CREATED_AT"]).total_seconds() / 86400.0

        relationship_years = None
        if pd.notna(row.get("RELATIONSHIP_START_DATE")):
            relationship_years = (AS_OF - row["RELATIONSHIP_START_DATE"]).days / 365.25

        engine_input = clean({
            "LEGAL_NAME": row.get("LEGAL_NAME"),
            "INCORPORATION_COUNTRY_ID": row.get("INCORPORATION_COUNTRY_ID"),
            "KYC_STATUS": row.get("KYC_STATUS"),
            "KYC_RISK_RATING": row.get("KYC_RISK_RATING"),
            "AMOUNT_USD": amount_usd,
            "SANCTIONS_HIT": row.get("SANCTIONS_HIT"),
            "PEP_ASSOCIATED": row.get("PEP_ASSOCIATED"),
            "UBO_PEP_COUNT": row.get("UBO_PEP_COUNT"),
            "UBO_SANCTIONS_MATCH_COUNT": row.get("UBO_SANCTIONS_MATCH_COUNT"),
            "FATF_STATUS": row.get("FATF_STATUS"),
            "COUNTRY_RISK_SCORE": row.get("COUNTRY_RISK_SCORE"),
            "PATTERN_RISK_SCORE": pattern_risk_score,
            "BASELINE_TRANSACTION_COUNT": row.get("BASELINE_TRANSACTION_COUNT"),
            "BASELINE_AVG_AMOUNT": row.get("BASELINE_AVG_AMOUNT"),
            "RELATIONSHIP_YEARS": relationship_years,
            "REQUIRES_EDD": row.get("REQUIRES_EDD"),
            "ADVERSE_MEDIA_FLAG": row.get("ADVERSE_MEDIA_FLAG"),
            "SLA_HOURS_LEFT": sla_hours_left,
            "ALERT_AGE_DAYS": alert_age_days,
        })

        result = calculate_v2_risk_score(engine_input)
        priority = derive_priority(row["STATUS"], engine_input, result, sla_breached)

        alert_id = row.get("ALERT_ID")
        narrative = {"alertSummary": None, "riskDriver": None, "recommendation": None}
        if has_alert:
            sub = joule_by_alert.get(int(alert_id), {})
            narrative = {
                "alertSummary": sub.get("ALERT_SUMMARY"),
                "riskDriver": sub.get("RISK_DRIVER"),
                "recommendation": sub.get("RECOMMENDATION"),
            }

        records.append({
            "caseId": str(int(row["CASE_ID"])),
            "caseNumber": row["CASE_NUMBER"],
            "caseTitle": row.get("CASE_TITLE") if pd.notna(row.get("CASE_TITLE")) else None,
            "companyId": str(int(row["COMPANY_ID"])),
            "legalName": row.get("LEGAL_NAME") if pd.notna(row.get("LEGAL_NAME")) else "Unknown",
            "caseType": row.get("CASE_TYPE") if pd.notna(row.get("CASE_TYPE")) else None,
            "status": row["STATUS"],
            "outcome": row.get("OUTCOME") if pd.notna(row.get("OUTCOME")) else None,
            "assignedAnalyst": row.get("ASSIGNED_ANALYST") if pd.notna(row.get("ASSIGNED_ANALYST")) else (
                row.get("ASSIGNED_TO") if pd.notna(row.get("ASSIGNED_TO")) else None
            ),
            "reviewingManager": row.get("REVIEWING_MANAGER") if pd.notna(row.get("REVIEWING_MANAGER")) else None,
            "openedAt": opened_at.isoformat(),
            "dueDate": due_date.isoformat(),
            "updatedAt": row["UPDATED_AT"].isoformat() if pd.notna(row.get("UPDATED_AT")) else None,
            "closedAt": row["CLOSED_AT"].isoformat() if pd.notna(row.get("CLOSED_AT")) else None,
            "daysElapsed": max(0, int(alert_age_days)) if alert_age_days is not None else max(0, (AS_OF - opened_at).days),
            "amountUsd": round(float(amount_usd), 2),
            "hasLinkedAlert": bool(has_alert),
            "alertId": f"ALERT-{int(alert_id)}" if has_alert else None,
            "transactionId": str(int(row["TRANSACTION_ID"])) if pd.notna(row.get("TRANSACTION_ID")) else None,
            "riskScore": result["risk_score"],
            "riskTier": result["risk_tier"],
            "evidenceConfidence": result["evidence_confidence"],
            "autoClearEligible": result["auto_clear_eligible"],
            "assignedQueue": result["assigned_queue"],
            "queueScore": result["queue_score"],
            "reasonCodes": result["reason_codes"],
            "factorScores": factor_scores(engine_input),
            "queueTerms": queue_terms(engine_input, result["risk_score"]),
            "priority": priority,
            "narrative": narrative,
            "_engineInput": engine_input,
        })

    return records


def build_parity_fixture(records):
    selected = {}

    def pick(predicate):
        for r in records:
            if r["caseId"] not in selected and predicate(r):
                selected[r["caseId"]] = r
                return True
        return False

    buckets = [
        lambda r: bool(r["_engineInput"].get("SANCTIONS_HIT")),
        lambda r: not r["_engineInput"].get("SANCTIONS_HIT") and int(r["_engineInput"].get("UBO_SANCTIONS_MATCH_COUNT", 0)) > 0,
        lambda r: not r["_engineInput"].get("SANCTIONS_HIT") and int(r["_engineInput"].get("UBO_SANCTIONS_MATCH_COUNT", 0)) == 0
        and (bool(r["_engineInput"].get("PEP_ASSOCIATED")) or int(r["_engineInput"].get("UBO_PEP_COUNT", 0)) > 0),
        lambda r: r["_engineInput"].get("FATF_STATUS") == "MEMBER",
        lambda r: r["_engineInput"].get("FATF_STATUS") == "GREY_LIST",
        lambda r: r["_engineInput"].get("FATF_STATUS") == "BLACK_LIST",
        lambda r: r["_engineInput"].get("FATF_STATUS") == "NON_COMPLIANT",
        lambda r: float(r["_engineInput"].get("PATTERN_RISK_SCORE", 0)) > 50,
        lambda r: float(r["_engineInput"].get("PATTERN_RISK_SCORE", 0)) <= 50,
        lambda r: float(r["_engineInput"].get("AMOUNT_USD", 0)) >= 100000,
        lambda r: float(r["_engineInput"].get("AMOUNT_USD", 0)) < 100000,
        lambda r: any(rc["code"] == "RC-BASELINE-DEVIATION" for rc in r["reasonCodes"]),
        lambda r: not any(rc["code"] == "RC-BASELINE-DEVIATION" for rc in r["reasonCodes"]),
        lambda r: r["assignedQueue"] == "AUTO_CLEAR",
        lambda r: r["assignedQueue"] == "DATA_CHASE",
        lambda r: r["assignedQueue"] == "ESCALATE",
        lambda r: r["assignedQueue"] == "STANDARD",
        lambda r, tier="HIGH": r["riskTier"] == tier,
        lambda r, tier="MEDIUM": r["riskTier"] == tier,
        lambda r, tier="LOW": r["riskTier"] == tier,
    ]
    for pred in buckets:
        pick(pred)

    idx = 0
    while len(selected) < 50 and idx < len(records):
        selected.setdefault(records[idx]["caseId"], records[idx])
        idx += 1

    fixture = [{"input": r["_engineInput"], "expected": calculate_v2_risk_score(r["_engineInput"])} for r in selected.values()]

    # Synthetic edge cases the real 500 rows don't happen to contain.
    template = dict(records[0]["_engineInput"])

    def missing_variant(n):
        d = dict(template)
        for f in REQUIRED_FIELDS[:n]:
            d.pop(f, None)
        return clean(d)

    synthetic_inputs = [
        {**template, "SLA_HOURS_LEFT": 0.0},
        {**template, "FATF_STATUS": "HIGH_RISK"},
        {**template, "BASELINE_TRANSACTION_COUNT": 10, "BASELINE_AVG_AMOUNT": 1000.0, "AMOUNT_USD": 5000.0},
        missing_variant(1),
        missing_variant(2),
        missing_variant(3),
        missing_variant(4),
    ]
    for inp in synthetic_inputs:
        cleaned = clean(inp)
        fixture.append({"input": cleaned, "expected": calculate_v2_risk_score(cleaned)})

    return fixture


def main():
    records = build()
    records.sort(key=lambda r: r["queueScore"], reverse=True)

    histogram = Counter(r["priority"] for r in records)
    print("Priority histogram:")
    order = ("regulatory", "overdue", "medium", "low", "closed")
    for k in order:
        print(f"  {k:12s} {histogram.get(k, 0)}")
    empty = [k for k in order if histogram.get(k, 0) == 0]
    assert not empty, f"Empty priority bucket(s): {empty}"

    fixture = build_parity_fixture(records)

    OUT_DIR.mkdir(exist_ok=True)
    clean_records = [{k: v for k, v in r.items() if k != "_engineInput"} for r in records]
    artifact = {
        "meta": {
            "weightVersion": WEIGHT_VERSION,
            "factorWeights": FACTOR_WEIGHTS,
            "queueWeights": QUEUE_WEIGHTS,
            "asOf": AS_OF.isoformat(),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalCases": len(clean_records),
        },
        "cases": clean_records,
    }

    out_path = OUT_DIR / "cases.json"
    out_path.write_text(json.dumps(artifact, default=str), encoding="utf-8")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"\nWrote {out_path} ({size_mb:.2f} MB, {len(clean_records)} cases)")
    assert size_mb < 2.5, f"Artifact too large: {size_mb:.2f} MB (limit 2.5 MB)"

    fixture_path = OUT_DIR / "scoring-parity-fixture.json"
    fixture_path.write_text(json.dumps(fixture, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {fixture_path} ({len(fixture)} records)")


if __name__ == "__main__":
    main()
