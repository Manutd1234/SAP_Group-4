"""
Deterministic Pre-Filtering & Data Abstraction Engine for SCALE 2026 / RiskSignal
Addresses:
- European 15-year-old legacy core banking system data abstraction.
- Immediate auto-resolution of high-volume false positives (e.g. HNW routine wire from pre-approved device).
- Instant human-readable reason codes for CRO explainability.
- Fast-track rollout avoiding the 4-6 month ML model validation bottleneck in Phase 1.
"""

import os
import json
import pandas as pd
from typing import Dict, List, Any

class DataAbstractionLayer:
    """Standardizes raw legacy transaction and customer data into unified schema."""
    @staticmethod
    def normalize_legacy_transaction(raw_tx: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "transaction_id": str(raw_tx.get("TRANSACTION_ID") or raw_tx.get("tx_id") or "TX-UNKNOWN"),
            "company_id": int(raw_tx.get("COMPANY_ID") or raw_tx.get("company_id") or 0),
            "amount_usd": float(raw_tx.get("AMOUNT_USD") or raw_tx.get("amount") or 0.0),
            "source_country": str(raw_tx.get("SOURCE_COUNTRY") or raw_tx.get("origin_country") or "DE"),
            "dest_country": str(raw_tx.get("DEST_COUNTRY") or raw_tx.get("dest_country") or "DE"),
            "ip_country": str(raw_tx.get("IP_COUNTRY") or raw_tx.get("ip_country") or "DE"),
            "device_status": str(raw_tx.get("DEVICE_STATUS") or "PRE_APPROVED"),
            "client_tier": str(raw_tx.get("CLIENT_TIER") or "HNW"),
            "relationship_tenure_years": float(raw_tx.get("TENURE_YEARS") or 5.0),
            "baseline_avg_amount": float(raw_tx.get("BASELINE_AVG") or 50000.0)
        }

class DeterministicPreFilterEngine:
    """Pre-filters high-volume false positives and appends CRO human-readable reason codes."""

    @classmethod
    def evaluate_transaction(cls, raw_tx: Dict[str, Any]) -> Dict[str, Any]:
        tx = DataAbstractionLayer.normalize_legacy_transaction(raw_tx)
        reasons = []
        is_auto_resolved = False
        resolution_category = "ESCALATE_TO_REVIEW"

        # Rule 1: High-Net-Worth HNW Client + Pre-Approved Device + Routine Wire -> Auto-Resolve
        if (tx["client_tier"] in ["HNW", "INSTITUTIONAL"] and 
            tx["device_status"] == "PRE_APPROVED" and 
            tx["relationship_tenure_years"] >= 2.0 and 
            tx["amount_usd"] <= tx["baseline_avg_amount"] * 2.0 and
            tx["source_country"] == tx["ip_country"]):
            
            is_auto_resolved = True
            resolution_category = "AUTO_RESOLVE_FALSE_POSITIVE"
            reasons.append("Auto-Resolved: Routine transaction by HNW long-standing client from pre-approved device")

        # Rule 2: Domestic low-risk wire within historical baseline
        elif (tx["source_country"] == tx["dest_country"] and 
              tx["amount_usd"] <= tx["baseline_avg_amount"] * 1.5):
            
            is_auto_resolved = True
            resolution_category = "AUTO_RESOLVE_FALSE_POSITIVE"
            reasons.append("Auto-Resolved: Domestic wire within historical 30-day baseline amount")

        # Else: Flag with human-readable reason codes for CRO explainability
        else:
            if tx["source_country"] != tx["ip_country"]:
                reasons.append(f"Flagged: Country mismatch between IP ({tx['ip_country']}) and Account Origin ({tx['source_country']})")
            if tx["amount_usd"] > tx["baseline_avg_amount"] * 3.0:
                multiple = round(tx["amount_usd"] / max(1, tx["baseline_avg_amount"]), 1)
                reasons.append(f"Flagged: High velocity/amount ({multiple}x above historical 30-day baseline)")
            if tx["device_status"] != "PRE_APPROVED":
                reasons.append(f"Flagged: Unrecognized device ({tx['device_status']})")
            if not reasons:
                reasons.append("Flagged: Cross-border transaction requires standard compliance review")

        return {
            "transaction_id": tx["transaction_id"],
            "company_id": tx["company_id"],
            "is_auto_resolved": is_auto_resolved,
            "resolution_category": resolution_category,
            "human_readable_reasons": reasons,
            "phase_1_decision": "AUTO_CLOSED" if is_auto_resolved else "FORWARDED_TO_NARROW_AI_AND_ANALYST",
            "legacy_system_adapted": "Europe 15-Year Legacy Core Banking Adapter"
        }

if __name__ == "__main__":
    print("Testing Deterministic Pre-Filter Engine...")
    test_hnw = {
        "TRANSACTION_ID": "TX-9901",
        "COMPANY_ID": 101,
        "AMOUNT_USD": 45000,
        "SOURCE_COUNTRY": "DE",
        "IP_COUNTRY": "DE",
        "CLIENT_TIER": "HNW",
        "DEVICE_STATUS": "PRE_APPROVED",
        "TENURE_YEARS": 4.5,
        "BASELINE_AVG": 50000
    }
    print("HNW Pre-Approved Test Output:", json.dumps(DeterministicPreFilterEngine.evaluate_transaction(test_hnw), indent=2))
