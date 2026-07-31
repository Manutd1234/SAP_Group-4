# RiskSignal — Financial Crime Case Management System

Full-stack SAP AI-powered case management system combining Marcus's Fiori-styled frontend with Ian's v2 scoring engine.

**Branch:** `marcus-v2` (unified integration of frontend + backend)

---

## 📋 Quick Navigation

- **Frontend Setup** → [app/FRONTEND.md](app/FRONTEND.md)
- **Backend Setup** → See [Backend](#-backend-setup) section below
- **System Architecture** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Scoring Logic** → [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md)
- **Workflows** → [docs/WORKFLOWS.md](docs/WORKFLOWS.md)

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- **Node.js** 22.13.0+
- **npm** 10+
- **Python** 3.10+ with `pandas`/`numpy` (required — the case data is generated at build time, not mocked)
- **Git**

### Setup

```bash
# Clone repository
git clone https://github.com/Manutd1234/SAP_Group-4.git
cd SAP_Group-4

# Install dependencies
npm install

# Generate the scored case dataset (reads datasets/*.csv, runs Ian's v2 engine, writes data/cases.json)
npm run data:build

# Start dev server
npm run dev
```

Open **http://localhost:3000** → the case dashboard loads all 500 real cases from `datasets/`, scored and ranked by the v2 engine, sorted by `queue_score` descending.

**Test the explainability modal:** click any row → the modal shows the per-factor score breakdown ("Why This Score") and the queue-ranking term breakdown ("Why This Rank"), both computed from the same run of Ian's engine that produced the row.

`data/cases.json` is committed, so `npm run dev` works even without re-running `data:build` — only re-run it after pulling dataset changes or editing the scoring engine.

---

## 🏗️ Full Architecture

```
datasets/*.csv (500 real cases, 5000 companies, 150K+ transactions)
        │  pandas joins (scripts/build_cases.py)
        ▼
narrow_ai/src/v2_scoring_engine.py   ← single source of truth for scoring math
        │  calculate_v2_risk_score() per case
        ▼
data/cases.json   (committed build artifact, ~0.6 MB)
        │  bundled at build time (plain `import`, resolveJsonModule)
        ▼
┌─────────────────────────────────────────────────────┐
│  API LAYER (Next.js, runs on Cloudflare Workers)     │
│  GET  /api/cases       → serves data/cases.json      │
│  POST /api/v2-scoring  → app/lib/v2-scoring.ts        │
│                           (TS mirror of the Python    │
│                           engine, parity-tested)      │
└─────────────────────────────────────────────────────┘
        │ fetch('/api/cases')
        ▼
┌─────────────────────────────────────────────────────┐
│  FRONTEND (Marcus) — app/                            │
│  page.tsx          owns cases/filters/selection state │
│  components/ShellBar.tsx        top nav bar           │
│  components/KpiTiles.tsx        5 priority tiles       │
│  components/CaseTable.tsx       sortable/filterable table (presentational) │
│  components/CaseDetailModal.tsx explainability modal   │
│  lib/cases.ts                   shared types + styles  │
└─────────────────────────────────────────────────────┘
```

Why build-time and not request-time: the app runs on Cloudflare Workers (`@cloudflare/vite-plugin`), which has no `child_process`/`fs` — there's no way to shell out to Python at request time. Scoring instead happens once, ahead of time, and the result is a plain JSON artifact the Worker serves directly.

---

## 📱 Frontend Setup

**Detailed guide:** [app/FRONTEND.md](app/FRONTEND.md)

**Quick start:**
```bash
npm run data:build   # only needed after a dataset or scoring-engine change
npm run dev
```

**What you'll see:**
- Next.js dev server on http://localhost:3000
- SAP Fiori-styled case dashboard: shell bar → 5 KPI tiles → case table → detail modal
- All 500 real cases from `datasets/`, scored by Ian's v2 engine
- Click a row to open the explainability modal (score breakdown, rank breakdown, Close/Escalate)

**Files:**
- `app/page.tsx` — owns fetched cases, filter state, and the selected-case-for-modal state
- `app/components/ShellBar.tsx`, `KpiTiles.tsx`, `CaseTable.tsx`, `CaseDetailModal.tsx` — presentational components
- `app/lib/cases.ts` — shared `CaseRecord` type, priority/status label & color maps
- `app/lib/v2-scoring.ts` — TypeScript mirror of the Python scoring engine (used by `/api/v2-scoring`)
- `app/api/cases/route.ts` — serves the build-time `data/cases.json` artifact
- `app/globals.css` + `app/app.css` — Tailwind v4 (`@import "tailwindcss" source(none)` + `@source "../app"`) layered under the hand-written Fiori component styles

---

## 🔧 Backend Setup

**Ian's code** is in `narrow_ai/` and is production-ready. `narrow_ai/src/v2_scoring_engine.py` is imported directly by `scripts/build_cases.py` — no changes needed for the demo.

### Regenerate the case dataset

```bash
npm run data:build
# = python scripts/build_cases.py
```

This reads `datasets/*.csv`, joins cases → alerts → transactions/companies/beneficial-owners/countries, calls `calculate_v2_risk_score()` from Ian's engine for every case, applies the priority cascade (closed → regulatory → overdue → medium → low), and writes:
- `data/cases.json` — the artifact the frontend serves (prints a 5-bucket priority histogram; fails the build if any bucket is empty or the artifact exceeds 2.5 MB)
- `data/scoring-parity-fixture.json` — ~60 stratified records (real + synthetic edge cases) with the Python engine's exact output, used by `tests/scoring-parity.test.mjs` to catch TS/Python drift

### Train the ML model (unrelated to the case dashboard, advanced/optional)

`narrow_ai/src/train_fincrime.py` trains a classifier on `OVERALL_RISK_SCORE` → `RISK_TIER`, which is a deterministic banding of that same column (target leakage) — it is **not** wired into the case dashboard and not part of the demo path.

```bash
cd narrow_ai
python src/train_fincrime.py
```

---

## 🧠 Scoring Engine (Ian's v2)

**Location:** `narrow_ai/src/v2_scoring_engine.py` (Python, source of truth) + `app/lib/v2-scoring.ts` (TypeScript mirror, used by `/api/v2-scoring`)

Two independent numbers drive prioritisation:

| Number | Question it answers | Formula |
|---|---|---|
| `risk_score` (0–100) | How bad is this? | COUNTERPARTY 30 + JURISDICTION 20 + STRUCTURAL 20 + DATA_INTEGRITY 15 + EXPOSURE 10 + BEHAVIOURAL 5 (VELOCITY retired at 0). Tiers: HIGH ≥60, MEDIUM ≥30, LOW <30 |
| `queue_score` (0–100) | What do I work on first? | `0.35·sla_urgency + 0.30·risk_score + 0.25·reg_exposure + 0.10·alert_age` |

The case table sorts by `queue_score` descending by default; the `priority` badge (low/medium/overdue/regulatory/closed) is a separate cascade computed once in `scripts/build_cases.py` and shipped in the artifact — see [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md) for the full P1–P5 cascade definition.

**4 operational queues** (`assigned_queue`):
- `AUTO_CLEAR` — proven low-risk, no manual review needed
- `DATA_CHASE` — evidence confidence < 0.6; obtain missing fields before review
- `STANDARD` — default operational cases (ranked by `queue_score`)
- `ESCALATE` — sanctions/PEP hit, or HIGH tier + high evidence confidence

**Keeping the TS mirror honest:** `tests/scoring-parity.test.mjs` POSTs every record in `data/scoring-parity-fixture.json` to `/api/v2-scoring` and asserts the TS output matches the Python-computed expected output (±0.01). Any future edit to `app/lib/v2-scoring.ts` or the Python weights that causes drift fails this test on the next `npm test`.

**Details:** See [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md)

---

## 📊 Data Integration

### Current state
- `/api/cases` serves the real, scored 500-case dataset from `data/cases.json` (build-time artifact, see [Backend Setup](#-backend-setup))
- Joule explanations come from `JOULE_EXPLANATIONS.EXPLANATION_TEXT`, joined via `CASE_ALERTS → ALERT_ID` (`ALERT_SUMMARY`/`RISK_DRIVER`/`RECOMMENDATION` map to the modal's narrative fields)
- Close Case / Escalate are client-side mutations only, mirrored to `sessionStorage` so an accidental refresh doesn't wipe the demo — there is no database (`.openai/hosting.json` has `d1: null`, so `env.DB` is genuinely unavailable in this environment)

### Not yet wired up
- Hybrid-RAG narrative retrieval in the modal (the honest version would run `hybrid_rag.py` inside `build_cases.py` and bake a `retrievedEvidence` field into the artifact)
- D1 persistence for Close/Escalate actions
- `train_fincrime.py` / `serve.py` (unrelated to the case dashboard; see [Scoring Engine](#-scoring-engine-ians-v2))

---

## 🔍 Common Error Messages & Debugging

### Frontend Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Case table shows "Loading cases…" forever | `/api/cases` not responding, or `data/cases.json` missing | `curl http://localhost:3000/api/cases`; if it 500s, run `npm run data:build` |
| `TypeError: Cannot read property 'cases' of undefined` | API returned an error instead of JSON | Check the browser console / Network tab for the API error message |
| `undefined is not a function` (on sort/filter) | Missing state or handler | Check `CaseTable.tsx` / `page.tsx` for the handler wiring |
| CSS looks broken (no colors/spacing) | Tailwind not compiled | Verify `app/globals.css` starts with `@import "tailwindcss" source(none);` then restart the dev server |
| A specific color/class never renders even though it's spelled correctly | Tailwind's `@source "../app"` scanner does not reach `app/lib/*.ts(x)` — classes that only exist as data (e.g. the color maps in `app/lib/cases.ts`) are invisible to it, even in a production build. Verified by direct test: a literal class in a probe file under `app/lib/` never compiled. | Force-generate them via `@source inline("class1 class2 ...")` in `app/globals.css` (see the comment there) rather than moving the values back into a `.tsx` file |

### API Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `/api/cases` fails to build/import | `data/cases.json` missing or malformed | `npm run data:build` and check its histogram output for errors |
| `500 Internal Server Error` from `/api/v2-scoring` | Malformed JSON body | POST a body with fields like `SANCTIONS_HIT`, `PEP_ASSOCIATED`, `COUNTRY_RISK_SCORE`, `AMOUNT_USD`, etc. |

### Next.js Dev Server Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Port 3000 already in use` | Another app is running on 3000 | `npx kill-port 3000` (or kill the process manually) |
| `Cannot find module 'react'` | Dependencies not installed | `npm install` |
| TypeScript compilation errors | Type mismatches in code | Read the error message; often a missing type annotation or wrong prop name |

### Python Build-Script Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ModuleNotFoundError: No module named 'pandas'` | Python dependencies missing | `pip install pandas numpy` |
| `AssertionError: Empty priority bucket(s): [...]` | A priority cascade bucket has zero cases | A dataset-quality issue upstream (e.g. a degenerate date column) — see the comments in `scripts/build_cases.py`'s SLA/age derivation for the kind of issue this has already caught once |
| `AssertionError: Artifact too large` | `data/cases.json` exceeds 2.5 MB | Check for an accidental large field being emitted per-row instead of once in `meta` |

---

## 🔗 Integration Points

### Frontend → Backend Flow

1. **Build time:** `npm run data:build` runs `scripts/build_cases.py`, which imports `calculate_v2_risk_score` from Ian's `v2_scoring_engine.py` directly (never re-implements the math) and writes `data/cases.json`.
2. **`GET /api/cases`** does a plain `import` of that JSON artifact (Vite's `vite:json` plugin inlines it at build time) and returns it as-is.
3. **`page.tsx`** fetches `/api/cases` on mount, owns the case list, filter state, and selected-case-for-modal state.
4. **`CaseTable`** is purely presentational — it receives `rows`/`filters`/`onFilterChange`/`onRowSelect` as props and does its own client-side sort (default: `queueScore` descending).
5. **Row click → `CaseDetailModal`** — renders the factor-score bars (using `factorScores` + the `factorWeights` shipped in the artifact's `meta`) and the queue-term breakdown (`queueTerms` + `queueWeights`), so the "why" is traceable back to the same engine run that produced the row.
6. **Close Case / Escalate** — client-side mutation, merged over the fetched cases and mirrored to `sessionStorage`.

---

## 📁 Project Structure

```
SAP_Group-4/
├── app/
│   ├── page.tsx                      # Owns cases/filters/selection state
│   ├── layout.tsx                    # Root HTML
│   ├── globals.css                   # Tailwind entry + @source scoping
│   ├── app.css                       # Fiori design tokens + component styles
│   ├── FRONTEND.md                   # Detailed frontend docs
│   ├── components/
│   │   ├── ShellBar.tsx              # Top nav bar
│   │   ├── KpiTiles.tsx              # 5 priority KPI tiles
│   │   ├── CaseTable.tsx             # Sortable/filterable table (presentational)
│   │   └── CaseDetailModal.tsx       # Explainability modal
│   ├── lib/
│   │   ├── cases.ts                  # Shared types, priority/status styles
│   │   └── v2-scoring.ts             # TS mirror of the Python scoring engine
│   └── api/
│       ├── cases/route.ts            # GET /api/cases — serves data/cases.json
│       └── v2-scoring/route.ts       # POST /api/v2-scoring — thin wrapper over lib/v2-scoring.ts
│
├── narrow_ai/                        # Ian's ML backend
│   └── src/
│       ├── v2_scoring_engine.py      # Scoring logic — single source of truth
│       ├── hybrid_rag.py             # RAG + entity graph (not yet wired into the dashboard)
│       ├── prefilter_engine.py       # Transaction classification (not yet wired in)
│       ├── train_fincrime.py         # Model training (unrelated to the dashboard; has target leakage)
│       └── serve.py                  # Model serving
│
├── datasets/                         # Source CSVs (500 cases, 5000 companies, 150K+ transactions)
│
├── data/                             # Build-time artifacts (committed)
│   ├── cases.json                    # Scored, ranked case dataset served by /api/cases
│   └── scoring-parity-fixture.json   # Python-computed expected outputs for the TS parity test
│
├── scripts/
│   └── build_cases.py                # Joins datasets/*.csv, scores via Ian's engine, writes data/
│
├── tests/
│   ├── rendered-html.test.mjs        # SSR + architecture-artefact checks
│   └── scoring-parity.test.mjs       # TS scoring engine vs Python engine, ±0.01 tolerance
│
├── docs/
│   ├── ARCHITECTURE.md               # System design & principles
│   ├── WORKFLOWS.md                  # Three problem workflows
│   ├── v2-scoring-plan.md            # Canonical scoring plan (READ THIS)
│   ├── discovery-report.md           # Evidence base for v2
│   └── pattern-findings.md           # Analysis & patterns
│
├── package.json                      # Dependencies + scripts (incl. data:build)
├── tsconfig.json                     # TypeScript config
└── README.md                         # This file
```

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Regenerate data/cases.json + data/scoring-parity-fixture.json from datasets/*.csv
npm run data:build

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Run production build locally
npm run start

# Lint code
npm run lint

# TypeScript type checking
npx tsc --noEmit

# Run tests (builds first, then runs both test files)
npm test
```

---

## 🚨 Deployment Checklist

Before shipping to production:

- [ ] Add database persistence for Close/Escalate actions (currently `sessionStorage`-only; `.openai/hosting.json` has `d1: null`)
- [ ] Wire the hybrid-RAG narrative into the modal (bake `retrievedEvidence` into `data/cases.json` at build time)
- [ ] Implement user authentication (currently assumed external)
- [ ] Add audit logging for all case actions (compliance requirement)
- [ ] Set up a CI step that runs `npm run data:build && npm test` on every dataset or scoring-engine change
- [ ] Set up monitoring/error tracking (Sentry, DataDog, etc.)
- [ ] Load test with realistic case volumes beyond the current 500

---

## 📚 Documentation

Read in this order:

1. **This file** (architecture + quick start)
2. [app/FRONTEND.md](app/FRONTEND.md) — Frontend setup + component guide
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design principles
4. [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md) — Scoring model details (§2), queue routing (§3)
5. [docs/WORKFLOWS.md](docs/WORKFLOWS.md) — End-to-end business workflows
6. [docs/discovery-report.md](docs/discovery-report.md) — Evidence base for v2 design

---

## 🔗 Useful URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend (case dashboard) |
| http://localhost:3000/api/cases | Real scored case dataset |
| http://localhost:3000/api/v2-scoring | Test scoring engine (POST) |
| http://localhost:3000/__debug | Vite debug page |

---

## 👥 Team

- **Marcus** (Frontend): UI/UX, dashboard components, build-time data pipeline
- **Ian** (Backend): Scoring engine, ML models, RAG, pre-filtering

**Branch:** `marcus-v2` (unified integration)

---

## 📝 License & Attribution

SAP SCALE 2026 — Team 04

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for regulatory & governance alignment details.

---

## 🆘 Need Help?

1. **Frontend question?** → Check [app/FRONTEND.md](app/FRONTEND.md)
2. **Scoring logic?** → See [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md) §2–3
3. **Error message?** → See [Common Error Messages & Debugging](#-common-error-messages--debugging) section above
4. **Architecture question?** → See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
5. **Bug/issue?** → Check git log or ask team lead
