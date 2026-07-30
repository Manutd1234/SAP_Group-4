# v2 — Scoring and Triage System Plan (RiskSignal / SCALE 2026)

**Status:** Proposed, supersedes the weighting scheme in `docs/v1-plan.md`.
**Evidence Base:** `docs/discovery-report.md` (incl. §5 addendum) and `docs/pattern-findings.md`.
**Cite As:** `weight_version: v2.0-draft` in every scored record and the audit ledger.

---

## 1. Context — Why v1 Needs Revising

`docs/v1-plan.md` assigned seven factor weights (25/15/15/15/10/10/10) from FATF/FinCEN reasoning alone. Calibration against real outcomes produced three core structural findings:

| v1 Assumption | What the Data Shows | Consequence |
|---|---|---|
| Six substantive factors are independent inputs | `TRANSACTION_RISK_SCORE` is **byte-identical** to `COUNTRY_RISK_SCORE`, and `BEHAVIORAL_RISK_SCORE` to `INDUSTRY_RISK_SCORE` across 100% of rows | Only **four** distinct company-level signals exist. A six-factor composite silently double-weights two of them. |
| Tier boundaries and weights can be calibrated against labels | Across 3,446 labelled alerts, every feature lift sits between 0.93x and 1.03x, and true-positive rate is ~28.0% base rate | **Outcome labels are statistically independent of every feature.** Precision-based calibration is impossible; system value comes from consistency and explainability. |
| Behavioural/Velocity factors ride on precomputed sub-scores | `VELOCITY_RISK_SCORE` and `FREQUENCY_RISK_SCORE` are near-identical (15.4 vs 15.4) | These two factors carry no discriminating information in this build. Weighting them is weighting noise. |

**Core Design Consequence:** A scoring system on this data cannot honestly claim measured precision. Its value proposition must be **consistency, explainability, and defensibility** — the same input always yields the same score with a point-by-point reason breakdown (`weight_version: v2.0-draft`).

---

## 2. Scoring Model (v2)

### 2.1 Collapse to Four Real Company-Level Signals
Drop `TRANSACTION_RISK_SCORE` and `BEHAVIORAL_RISK_SCORE` as independent inputs. Retain **Country**, **Industry**, **Ownership**, and treat `COMPOSITE_RISK_SCORE` as a reference.

### 2.2 Factor Set and Weights (`weight_version: v2.0-draft`)

| # | Factor | v1 | v2 | Basis for Change |
|---|---|---|---|---|
| 1 | **Counterparty** (Sanctions / PEP / Opacity) | 25 | **30** | Sourced directly from `SANCTIONS_HIT`, `PEP_ASSOCIATED`, `IS_PEP`, `SANCTIONS_MATCH`, `OWNERSHIP_PERCENTAGE`. Absorbs weight from inert factors. |
| 2 | **Geography / Jurisdiction** | 15 | **20** | Derived from ledger primitives (`ORIGINATING_COUNTRY_ID`, `DESTINATION_COUNTRY_ID`, `IS_CROSS_BORDER`) joined to `COUNTRIES.FATF_STATUS` and `CORRUPTION_INDEX`. |
| 3 | **Structural** (Structuring / Threshold Proximity) | 15 | **20** | Derived from ledger `AMOUNT_USD` and `PATTERN_RISK_SCORE` (which showed 22.6 vs 9.5 anomaly separation). |
| 4 | **Exposure** (Value / Materiality) | 10 | **10** | Unchanged. Sourced directly from ledger `AMOUNT_USD`. |
| 5 | **Behavioural** (Baseline Deviation) | 15 | **5** | Demoted. Gated by baseline history: if `TRANSACTION_COUNT < 5`, contribute 0 and raise a Data Integrity signal. |
| 6 | **Velocity** | 10 | **0 (Retired)** | 15.4 vs 15.4 — zero separation. Retired and logged in model-risk register. |
| 7 | **Data Integrity** | 10 | **15** | Promoted. Assesses null fields and missing documentation. Cannot alone reach top tier. |
| | **Total** | 100 | **100** | |

### 2.3 Two-Axis Output
Every scored record emits **two independent values**:
- **`risk_score` (0–100)**: Drives `risk_tier` (`LOW`, `MEDIUM`, `HIGH`).
- **`evidence_confidence` (0.0–1.0)**: Measures complete knowledge of required fields.

### 2.4 Queue Ranking Formula
Queue prioritization uses the multi-factor weighted urgency model:
$$\text{queue\_score} = w_1 \cdot \text{SLA\_breach\_urgency} + w_2 \cdot \text{COMPOSITE\_RISK\_SCORE} + w_3 \cdot \text{regulatory\_exposure\_proxy} + w_4 \cdot \text{alert\_age}$$

where $\text{regulatory\_exposure\_proxy} = 1.0$ if (`SANCTIONS_HIT` OR `PEP_ASSOCIATED` OR High-Risk Country), else $0.0$.

---

## 3. Triage & Four-Queue Ranking System

Instead of a single score-threshold list, alerts are routed into four dedicated operational queues:

```
                  +---------------------------------------------------+
                  |                 Incoming AML Alert                |
                  +---------------------------------------------------+
                                            |
                       +--------------------+--------------------+
                       |                                         |
                       v                                         v
       [Is Auto-Clear Eligible?]                     [Is Confidence < 0.6?]
       (Age > 2yr, KYC LOW, No PEP/Sanctions,        (Missing mandatory data)
        Confidence >= 0.8, No Prior TP)                          |
                       |                                         v
             +---------+---------+                      +------------------+
             |                   |                      | DATA-CHASE QUEUE |
             v                   v                      +------------------+
    +------------------+  +-------------------+
    | AUTO-CLEAR QUEUE |  |  Mandatory Review |
    |   (Sampled QA)   |  |  or HIGH Tier?    |
    +------------------+  +---------+---------+
                                    |
                         +----------+----------+
                         |                     |
                         v                     v
                 +---------------+    +------------------+
                 | ESCALATE QUEUE|    |  STANDARD QUEUE  |
                 | (Priority SAR)|    |  (Ranked by      |
                 +---------------+    |   queue_score)   |
                                      +------------------+
```

| Queue | Entry Condition | Analyst Action | Target Vol % |
|---|---|---|---|
| **Auto-clear** | Passes §3.1 exclusion rule | Sampled QA (10% audit) | ~8.9% |
| **Data-chase** | `evidence_confidence < 0.6` | Obtain missing data before review | ~12.1% |
| **Standard** | Default operational cases | Review ranked by `queue_score` descending | ~64.0% |
| **Escalate** | Sanctions/PEP hit OR (`HIGH` tier AND `confidence >= 0.8`) | Priority investigation & SAR decision | ~15.0% |

---

## 4. Validation & Governance Strategy

Given outcome label independence in historical data, validation is conducted via:
1. **Determinism / Reproducibility Tests**: Same input $\rightarrow$ Same score + reason codes + version stamp (`v2.0-draft`).
2. **Rule-Coverage Tests**: 100% of `SCREENING_RULES` map to valid reason codes.
3. **Safety Backtest on Auto-Clear**: Verified **0 historical True Positives** swept into auto-clear segment (0 / 445).
4. **Works Council Protection**: Aggregates all performance analytics at team level to prevent individual analyst tracking.
