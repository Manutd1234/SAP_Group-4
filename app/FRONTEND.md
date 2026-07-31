# Frontend Documentation — Case Management UI

Detailed guide for Marcus's Fiori-styled case management dashboard (Next.js + React + TypeScript + Tailwind v4).

---

## 📍 Quick Links

- **Main README** → [../README.md](../README.md)
- **System Architecture** → [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Scoring Details** → [../docs/v2-scoring-plan.md](../docs/v2-scoring-plan.md)

---

## 🎯 What This UI Does

`app/page.tsx` renders: **shell bar → 5 KPI tiles → case table → detail modal**, driven by the real 500-case dataset in `datasets/`, scored at build time by Ian's v2 engine (see [../README.md](../README.md#-full-architecture) for the build-time pipeline).

- Priority badges (low / medium / overdue / regulatory / closed — a P1–P5 cascade computed once in `scripts/build_cases.py`, not re-derived client-side)
- 5 KPI tiles that double as filter toggles, kept in sync with the table's priority filter (one shared piece of state)
- Sortable table (default: `queueScore` descending — "what do I work on first")
- Search + priority + status filtering, all client-side
- Click a row → explainability modal: per-factor score breakdown, queue-rank term breakdown, and Close Case / Escalate actions

**Data source:** `/api/cases`, which serves the committed build-time artifact `data/cases.json` (see [../README.md](../README.md#-backend-setup) for how to regenerate it).

---

## 📦 Component Structure

```
app/
├── page.tsx                      # Owns: fetched cases, filter state, selected-case-for-modal
├── lib/
│   ├── cases.ts                  # CaseRecord type, Priority/Status label & color maps, displayStatus()
│   └── v2-scoring.ts             # TS mirror of narrow_ai/src/v2_scoring_engine.py
└── components/
    ├── ShellBar.tsx               # Top nav bar (decorative — no client routing behind it)
    ├── KpiTiles.tsx                # 5 priority tiles, controlled by page.tsx
    ├── CaseTable.tsx               # Presentational: rows/filters/onFilterChange/onRowSelect
    └── CaseDetailModal.tsx         # Explainability modal
```

`page.tsx` is the only component that calls `fetch()`. Every other component is presentational — it takes data and callbacks as props and has no knowledge of `/api/cases`.

### State ownership

`page.tsx` owns:
```typescript
cases: CaseRecord[]             // fetched from /api/cases
meta: CasesArtifactMeta | null  // factorWeights, queueWeights, asOf, etc.
mutations: Record<string, Partial<CaseRecord>>  // Close/Escalate edits, mirrored to sessionStorage
filters: { priority, status, search }           // shared by KpiTiles and CaseTable
selectedCaseId: string | null                   // drives CaseDetailModal
```

`filters.priority` is the single source of truth for "which priority is active" — `KpiTiles`' `active` prop and `CaseTable`'s priority `<select>` both read and write it, so clicking a tile and picking the same value from the dropdown are the same action (clicking an already-active tile clears the filter).

`CaseTable` keeps sort key/direction as its own local state (a pure display concern) but takes everything else as props.

---

## 🎨 User Interface

```
┌──────────────────────────────────────────────────────────────────┐
│ S4  SAP Case Management     Home  Cases  Alerts  Reports  Admin  JM│
└──────────────────────────────────────────────────────────────────┘
Case Management

┌ LOW ──────┐ ┌ MEDIUM ───┐ ┌ OVERDUE ──┐ ┌ REGULATORY┐ ┌ CLOSED ───┐
│    62     │ │    12     │ │    20     │ │    62     │ │   344     │
└───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘

┌ Search   ┐ ┌ Priority ▼ ┐ ┌ Status ▼ ┐                156 of 500 cases
├──────────────────────────────────────────────────────────────────┤
│ PRIORITY ↕ │ CASE ↕ │ RISK ↕ │ QUEUE SCORE ↓ │ AGE ↕ │ STATUS │ AMOUNT│
├──────────────────────────────────────────────────────────────────┤
│ ● Regulatory │ Intelius PARTNERSHIP │ ▬▬▬▬ 76.6 │ 92.98 │ 549d │ Escalated │ $3.9M │
└──────────────────────────────────────────────────────────────────┘
```

Clicking a row opens `CaseDetailModal` (`role="dialog"`, `aria-modal`, Escape-to-close, focus trap, overlay-click-close):

```
Intelius PARTNERSHIP                                            ✕
CASE-000286 · 1786

CASE SUMMARY
<Joule ALERT_SUMMARY text, or "No Joule summary available">
Assigned To · Case Type · Amount · Last Updated · Resolution Target · Reviewing Manager

WHY THIS SCORE                              risk 76.6 / 100 · HIGH
  Counterparty    ████████████████████████  30 / 30
  Jurisdiction    ████████████████████      20 / 20
  Structural      ████████████████░░░░      16.6 / 20
  ...
  Reason codes: RC-SANCTION-HIT, RC-FATF-JURISDICTION, ...

WHY THIS RANK                                queue 92.98 / 100
  SLA urgency    100 × 0.35 = 35.0
  Risk score     76.6 × 0.3 = 23.0
  Reg exposure   100 × 0.25 = 25.0
  Alert age      100 × 0.1 = 10.0

Evidence confidence 1                        Queue: ESCALATE
[ Close Case ]                                          [ Escalate ]
```

The factor-bar maxima come from `meta.factorWeights` (shipped once in the artifact, not hardcoded in TSX) and the earned points come from `factorScores` on the case record — both computed in `scripts/build_cases.py` by mirroring the engine's own arithmetic, since `calculate_v2_risk_score()` itself only returns the total.

---

## 📊 Data Model

`app/lib/cases.ts` is the source of truth for the frontend's `CaseRecord` type — it mirrors exactly what `scripts/build_cases.py` writes into `data/cases.json`:

```typescript
interface CaseRecord {
  caseId: string; caseNumber: string; caseTitle: string | null;
  companyId: string; legalName: string; caseType: string | null;
  status: 'OPEN' | 'CLOSED'; outcome: string | null;
  assignedAnalyst: string | null; reviewingManager: string | null;
  openedAt: string; dueDate: string; updatedAt: string | null; closedAt: string | null;
  daysElapsed: number; amountUsd: number;
  hasLinkedAlert: boolean; alertId: string | null; transactionId: string | null;
  riskScore: number; riskTier: 'HIGH' | 'MEDIUM' | 'LOW'; evidenceConfidence: number;
  autoClearEligible: boolean; assignedQueue: 'AUTO_CLEAR' | 'DATA_CHASE' | 'ESCALATE' | 'STANDARD';
  queueScore: number; reasonCodes: ReasonCode[];
  factorScores: FactorScores; queueTerms: QueueTerms;
  priority: 'low' | 'medium' | 'overdue' | 'regulatory' | 'closed';
  narrative: { alertSummary: string | null; riskDriver: string | null; recommendation: string | null };
}
```

`status` (`OPEN`/`CLOSED`) is the raw case status; `displayStatus()` in `app/lib/cases.ts` derives the richer badge text (`Open` / `Escalated` / `Overdue` / `Auto-Clear` / `Data Chase` / `Closed`) from `status` + `assignedQueue` + `priority`. Precedence is closed → escalated → overdue → auto-clear/data-chase → open: a case that's both ESCALATE-queued (Ian's risk-based queue routing) and SLA-breached shows as Escalated, not Overdue — regulatory concerns outrank timeliness.

---

## 🔌 API Integration

### GET /api/cases

```json
{
  "success": true,
  "count": 500,
  "meta": {
    "weightVersion": "v2.0-draft",
    "factorWeights": { "COUNTERPARTY": 30, "JURISDICTION": 20, "...": "..." },
    "queueWeights": { "slaUrgency": 0.35, "riskScore": 0.3, "regExposure": 0.25, "alertAge": 0.1 },
    "asOf": "2026-07-30T17:07:00",
    "totalCases": 500
  },
  "cases": [ { "caseId": "1786", "legalName": "Intelius PARTNERSHIP", "riskScore": 76.6, "...": "..." } ]
}
```

The route is a two-line wrapper (`app/api/cases/route.ts`) around a plain `import` of `data/cases.json` — no runtime CSV parsing, no Python at request time (the app runs on Cloudflare Workers, which has neither `child_process` nor `fs`).

### POST /api/v2-scoring

Thin wrapper around `calculateV2RiskScore()` in `app/lib/v2-scoring.ts`. Used by `tests/scoring-parity.test.mjs` to catch drift against the Python engine — POST a record with fields like `SANCTIONS_HIT`, `AMOUNT_USD`, `FATF_STATUS`, etc. and it returns the same shape as `calculate_v2_risk_score()` in Python.

---

## 🐛 Known Gaps

- **No persistence:** Close/Escalate mutate local state, mirrored to `sessionStorage` only (survives a refresh, not a new session) — there's no database wired up (`.openai/hosting.json` has `d1: null`)
- **No Joule retrieval:** the modal shows `narrative.alertSummary` from the artifact; live hybrid-RAG retrieval isn't wired in (see [../README.md](../README.md#-data-integration))
- **No pagination/virtualization:** 500 rows render fine without it; would need addressing well before 5,000+

---

## 🧪 Testing

- `npm test` — builds the app, then runs `tests/rendered-html.test.mjs` (SSR smoke test + architecture-artefact checks) and `tests/scoring-parity.test.mjs` (TS scoring engine vs Python engine, ±0.01 tolerance, over `data/scoring-parity-fixture.json`)
- Manual checklist: load the dashboard, click a KPI tile (table filters, count matches the tile), click it again (filter clears), search a legal name, click a row (modal opens with score/rank breakdowns that sum to `riskScore`/`queueScore`), close via the ✕ and via Escape, Close Case (row leaves the default view, Closed tile increments), Escalate (only priorities above the current one are offered; disabled once already Overdue/Regulatory)

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Fetches cases, owns filter/selection state, composes the four components |
| `app/lib/cases.ts` | `CaseRecord` type + priority/status label & color maps |
| `app/lib/v2-scoring.ts` | TS mirror of the Python scoring engine |
| `app/globals.css` + `app/app.css` | Tailwind v4 entry + Fiori design tokens/component styles |
| `app/api/cases/route.ts` | Serves `data/cases.json` |
| `scripts/build_cases.py` | Builds `data/cases.json` from `datasets/*.csv` via Ian's engine |
| `../docs/v2-scoring-plan.md` | Scoring logic behind `riskScore`/`queueScore`/`priority` |
| `../docs/ARCHITECTURE.md` | System design context |

---

**Last updated:** 2026-07-31
**Maintained by:** Marcus (Frontend)
