# RiskSignal — Financial Crime Case Management System

Full-stack SAP AI-powered case management system combining Marcus's Fiori-styled frontend with Ian's v2 scoring engine and ML models.

**Branch:** `marcus-v2` (unified integration of frontend + backend)

---

## 📋 Quick Navigation

- **Frontend Setup** → [app/FRONTEND.md](app/FRONTEND.md)
- **Backend Setup** → See [Backend](#backend-setup) section below
- **System Architecture** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Scoring Logic** → [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md)
- **Workflows** → [docs/WORKFLOWS.md](docs/WORKFLOWS.md)

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- **Node.js** 22.13.0+
- **npm** 10+
- **Python** 3.8+ (optional, for ML model training)
- **Git**

### Setup

```bash
# Clone repository
git clone https://github.com/Manutd1234/SAP_Group-4.git
cd SAP_Group-4

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open **http://localhost:3000** → Click **"Cases"** nav button → See case table with 3 mock cases

**Test hover tooltip:** Move mouse over any case row → Black tooltip shows Joule AI explanation

---

## 🏗️ Full Architecture

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (Marcus)                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │ Next.js 16 + React 19 + TypeScript           │  │
│  │ - CaseTable component (Fiori UI)             │  │
│  │ - Hover tooltips (Joule explanations)        │  │
│  │ - Filtering, sorting, escalation             │  │
│  │ - app/page.tsx (router)                      │  │
│  │ - app/components/CaseTable.tsx (table UI)    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↓ (HTTP requests)
┌─────────────────────────────────────────────────────┐
│  API LAYER (Next.js)                                │
│  ┌───────────────────────────────────────────────┐  │
│  │ GET /api/cases (Marcus)                       │  │
│  │ - Assembles case records                      │  │
│  │ - Applies v2 scoring                          │  │
│  │ - Returns: risk_score, queue, Joule explain   │  │
│  │                                                │  │
│  │ POST /api/v2-scoring (Ian)                    │  │
│  │ - Scoring engine: 6 weighted risk factors    │  │
│  │ - Queue ranking formula                       │  │
│  │                                                │  │
│  │ POST /api/hybrid-rag (Ian)                    │  │
│  │ - RAG + entity graph search                   │  │
│  │                                                │  │
│  │ POST /api/prefilter (Ian)                     │  │
│  │ - Transaction screening                       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↓ (Python → JSON)
┌─────────────────────────────────────────────────────┐
│  BACKEND (Ian)                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Python + ML Models (narrow_ai/)               │  │
│  │ - v2_scoring_engine.py (scoring logic)       │  │
│  │ - hybrid_rag.py (RAG + graph)                │  │
│  │ - prefilter_engine.py (screening)            │  │
│  │ - train_fincrime.py (model training)         │  │
│  │ - fincrime_classifier.pkl (ML model)         │  │
│  │ - fincrime_scaler.pkl (feature scaling)      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↓ (CSV files)
┌─────────────────────────────────────────────────────┐
│  DATA (datasets/)                                   │
│  - COMPLIANCE_CASES, RISK_ALERTS, COMPANIES        │
│  - JOULE_EXPLANATIONS (AI explanations)            │
│  - TRANSACTION_BASELINES, TRANSACTION_RISK_SCORES  │
│  - SANCTIONS_LISTS, SCREENING_RULES, etc.          │
└─────────────────────────────────────────────────────┘
```

---

## 📱 Frontend Setup

**Detailed guide:** [app/FRONTEND.md](app/FRONTEND.md)

**Quick start:**
```bash
npm install
npm run dev
```

**What you'll see:**
- Next.js dev server on http://localhost:3000
- Case management dashboard with Fiori UI
- 3 mock cases (real data integration coming later)
- Hover tooltips showing Joule AI explanations

**Files:**
- `app/page.tsx` — Main layout + view router
- `app/components/CaseTable.tsx` — Case table component
- `app/api/cases/route.ts` — Case assembly endpoint
- `app/globals.css` — Tailwind theme + Fiori colors

---

## 🔧 Backend Setup

**Ian's code** is in `narrow_ai/` and is production-ready. No changes needed for MVP.

### Option 1: Use Mock Data (Current MVP)

Dev mode already uses mock data in `/api/cases`. No additional setup needed.

```bash
npm run dev  # Already runs with mock cases
```

### Option 2: Connect Real CSV Data (Production)

To load actual case data instead of mocks:

1. **Ensure datasets exist:**
   ```bash
   ls datasets/
   # Should see: COMPLIANCE_CASES_*.csv, RISK_ALERTS_*.csv, COMPANIES_*.csv, etc.
   ```

2. **Update `app/api/cases/route.ts`:**
   - Replace mock data return with actual CSV loading
   - Join tables on COMPANY_ID, TRANSACTION_ID, ALERT_ID
   - Call v2 scoring per case

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

### Option 3: Train ML Model (Advanced)

Retrain the ML classifier on your data:

```bash
cd narrow_ai
python3 src/train_fincrime.py
```

Output: New `narrow_ai/model/fincrime_classifier.pkl`

---

## 🧠 Scoring Engine (Ian's v2)

**Location:** `narrow_ai/src/v2_scoring_engine.py` (Python) + `app/api/v2-scoring/route.ts` (TypeScript)

**Scoring formula:**
```
queue_score = 0.35 × SLA_urgency + 0.30 × risk_score + 0.25 × regulatory_exposure + 0.10 × alert_age
```

**6 weighted risk factors:**
1. **Counterparty** (30%): Sanctions/PEP/UBO opacity
2. **Jurisdiction** (20%): FATF status + country risk
3. **Structural** (20%): Pattern anomalies + transaction structuring
4. **Exposure** (10%): Amount/value materiality
5. **Behavioural** (5%): Baseline deviation (min 5 historical transactions)
6. **Data Integrity** (15%): Missing mandatory fields

**4 operational queues:**
- `AUTO_CLEAR`: Proven low-risk (8.9% of alerts, zero false negatives)
- `DATA_CHASE`: Incomplete data; obtain missing fields before review
- `STANDARD`: Default operational cases (ranked by queue_score)
- `ESCALATE`: Mandatory review triggers (sanctions/PEP hit OR HIGH tier + high confidence)

**Details:** See [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md)

---

## 📊 Data Integration

### Current State (MVP)
- Frontend uses **mock data** (3 sample cases in `/api/cases`)
- Joule explanations are hardcoded strings
- No database persistence

### Production Roadmap
1. **Phase 1:** Load real CSVs → assemble cases → apply scoring
2. **Phase 2:** Add database layer (PostgreSQL/Firebase) for case persistence
3. **Phase 3:** Implement audit logging + SAR filing workflow

---

## 🔍 Common Error Messages & Debugging

### Frontend Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Case table shows "Loading..." forever` | `/api/cases` not responding | `curl http://localhost:3000/api/cases` to test API |
| `TypeError: Cannot read property 'cases' of undefined` | API returned error instead of JSON | Check browser Console for API error message |
| `Joule tooltips don't appear on hover` | `jouleExplanation` field is null/empty | Verify mock data in `/api/cases` has explanations |
| `undefined is not a function` (on sort/filter) | Missing state or handler | Check `CaseTable.tsx` for handler functions |
| `CSS looks broken (no colors/spacing)` | Tailwind not compiled | Try `npm install` + restart dev server |

### API Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `{"error":"no such file or directory, readdir '/bundle/datasets/cleaned'"}` | API route trying to load CSVs (mock data mode not active) | Current `/api/cases` returns mock data; this error only occurs if you uncommented CSV loading code |
| `500 Internal Server Error` from `/api/v2-scoring` | Missing required fields in request body | Ensure request has: `SANCTIONS_HIT`, `PEP_ASSOCIATED`, `COUNTRY_RISK_SCORE`, etc. |
| `POST /api/cases 404 Not Found` | API route doesn't exist | Check that `app/api/cases/route.ts` exists |

### Next.js Dev Server Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `WRANGLER_LOG_PATH is not recognized` | Windows PowerShell trying to parse Unix env var syntax | Already fixed in `package.json`; if you see it, pull latest or run: `npm run dev` directly |
| `Port 3000 already in use` | Another app is running on 3000 | `npx kill-port 3000` (or kill process manually) |
| `Cannot find module 'react'` | Dependencies not installed | `npm install` |
| `TypeScript compilation errors` | Type mismatches in code | Read error message carefully; often a missing type annotation or wrong prop name |

### Python Backend Errors (if running Ian's code)

| Error | Cause | Solution |
|-------|-------|----------|
| `ModuleNotFoundError: No module named 'pandas'` | Python dependencies missing | `pip install -r narrow_ai/requirements.txt` (if it exists) or `pip install pandas numpy scikit-learn joblib` |
| `FileNotFoundError: [Errno 2] No such file or directory: 'narrow_ai/model/fincrime_classifier.pkl'` | Model file missing | Run `python3 narrow_ai/src/train_fincrime.py` to train or pull pre-trained model from repo |
| `OSError: Cannot open file...` when loading pickle | Model file corrupted or wrong version | Re-download or retrain model |

---

## 🔗 Integration Points

### Frontend → Backend Flow

1. **User opens http://localhost:3000/cases**
   - `CaseTable.tsx` mounts
   - `useEffect` calls `fetch('/api/cases')`

2. **`GET /api/cases` (Marcus's route)**
   - Currently: Returns 3 mock cases
   - Future: Load CSVs, score each, return with Joule explanations

3. **Return to Frontend**
   - CaseTable renders table rows with: legalName, transactionId, riskTier, status, jouleExplanation
   - On hover: Tooltip shows jouleExplanation

4. **User Action: Filter/Sort**
   - CaseTable state updates (client-side)
   - No API call needed (data already in memory)

5. **User Action: View Case**
   - Click row to select (currently no detail view, just highlights row)
   - Future: Open detail panel with full case info + Joule Q&A

### Backend Scoring Flow

If real CSV data were wired up:

1. **`GET /api/cases` loads CSVs**
2. **For each case record:**
   - Extract company + transaction data
   - Call `/api/v2-scoring` (Ian's engine) with company fields
   - Receive: risk_score, risk_tier, assigned_queue, queue_score
   - Lookup Joule explanation from JOULE_EXPLANATIONS.csv
   - Assemble CaseRecord

3. **Return to frontend** with enriched data

---

## 📁 Project Structure

```
C:\Users\marcu\SAP_Group-4\
├── app/
│   ├── page.tsx                      # Main layout + view router
│   ├── layout.tsx                    # Root HTML
│   ├── globals.css                   # Tailwind + theme
│   ├── FRONTEND.md                   # Detailed frontend docs
│   ├── components/
│   │   └── CaseTable.tsx             # Fiori case table (15KB)
│   └── api/
│       ├── cases/route.ts            # GET /api/cases (Marcus)
│       ├── v2-scoring/route.ts       # POST /api/v2-scoring (Ian)
│       ├── hybrid-rag/route.ts       # POST /api/hybrid-rag (Ian)
│       └── prefilter/route.ts        # POST /api/prefilter (Ian)
│
├── narrow_ai/                        # Ian's ML backend (do not edit)
│   ├── src/
│   │   ├── v2_scoring_engine.py      # Scoring logic (Python)
│   │   ├── hybrid_rag.py             # RAG + entity graph
│   │   ├── prefilter_engine.py       # Transaction classification
│   │   ├── train_fincrime.py         # Model training
│   │   └── serve.py                  # Model serving
│   ├── model/
│   │   ├── fincrime_classifier.pkl   # ML model (binary)
│   │   └── fincrime_scaler.pkl       # Feature scaler
│   └── Dockerfile                    # Container definition
│
├── datasets/                         # Data files (150K transaction records)
│   ├── COMPLIANCE_CASES_*.csv        # Case records
│   ├── RISK_ALERTS_*.csv             # Alert records
│   ├── COMPANIES_*.csv               # Company info
│   ├── JOULE_EXPLANATIONS_*.csv      # AI explanations (hover tooltips)
│   ├── TRANSACTION_BASELINES_*.csv   # Historical patterns
│   └── ... (other reference tables)
│
├── docs/
│   ├── ARCHITECTURE.md               # System design & principles
│   ├── WORKFLOWS.md                  # Three problem workflows
│   ├── v2-scoring-plan.md            # Canonical scoring plan (READ THIS)
│   ├── discovery-report.md           # Evidence base for v2
│   └── pattern-findings.md           # Analysis & patterns
│
├── scripts/                          # Analysis scripts
│   ├── analyze-risk-patterns.cjs
│   ├── lib.cjs
│   └── ...
│
├── package.json                      # Dependencies + scripts
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind theme
└── README.md                         # This file
```

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

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

# Train ML model (if you modify training data)
python3 narrow_ai/src/train_fincrime.py
```

---

## 🚨 Deployment Checklist

Before shipping to production:

- [ ] Replace mock data in `/api/cases` with real CSV loading
- [ ] Test with actual COMPLIANCE_CASES, RISK_ALERTS, COMPANIES, JOULE_EXPLANATIONS CSVs
- [ ] Add database for case persistence (cases table: id, user_id, assigned_to, status, decision, etc.)
- [ ] Implement user authentication (currently assumed external)
- [ ] Add audit logging for all case actions (compliance requirement)
- [ ] Test scoring logic against known risk cases
- [ ] Verify Joule explanations display correctly (no truncation/encoding issues)
- [ ] Set up monitoring/error tracking (Sentry, DataDog, etc.)
- [ ] Document environment variables (if any added)
- [ ] Load test with realistic case volumes (currently 3 mock cases)

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
| http://localhost:3000 | Frontend (Cases view) |
| http://localhost:3000/api/cases | Test case data |
| http://localhost:3000/api/v2-scoring | Test scoring engine (POST) |
| http://localhost:3000/__debug | Vite debug page |

---

## 👥 Team

- **Marcus** (Frontend): UI/UX, CaseTable component, case assembly API
- **Ian** (Backend): Scoring engine, ML models, RAG, pre-filtering

**Branch:** `marcus-v2` (unified integration)

---

## 📝 License & Attribution

SAP SCALE 2026 — Team 04

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for regulatory & governance alignment details.

---

## 🆘 Need Help?

1. **Frontend question?** → Check [app/FRONTEND.md](app/FRONTEND.md) or `app/components/CaseTable.tsx` comments
2. **Scoring logic?** → See [docs/v2-scoring-plan.md](docs/v2-scoring-plan.md) §2–3
3. **Error message?** → See [Common Error Messages & Debugging](#-common-error-messages--debugging) section above
4. **Architecture question?** → See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
5. **Bug/issue?** → Check git log or ask team lead
