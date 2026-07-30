# Frontend Documentation — Case Management UI

Detailed guide for Marcus's Fiori-styled case management dashboard (Next.js + React + TypeScript + Tailwind).

---

## 📍 Quick Links

- **Main README** → [../README.md](../README.md)
- **System Architecture** → [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Scoring Details** → [../docs/v2-scoring-plan.md](../docs/v2-scoring-plan.md)

---

## 🎯 What This Component Does

The **CaseTable** component displays a sortable, filterable table of financial crime cases with:
- Priority badges (color-coded by risk tier: LOW/MEDIUM/HIGH)
- Status tracking (Open, In Review, Resolved, etc.)
- Days elapsed progress bar
- **Hover tooltips** showing Joule AI explanations
- Real-time filtering by priority and status
- Search by case name or ID
- Sortable columns (Priority, Case, Created Date, Days Elapsed)

**Data source:** `/api/cases` (Marcus's route that assembles cases + applies v2 scoring)

---

## 📦 Component Structure

### `CaseTable.tsx` (500 lines)

**Entry point:** `app/components/CaseTable.tsx`

**Main responsibilities:**
1. Fetch case data from `/api/cases` on mount
2. Manage table state (filtering, sorting, search)
3. Render Fiori-styled table with Tailwind CSS
4. Show/hide Joule tooltips on hover
5. Support in-place priority updates

**Props:** None (fully self-contained)

**State:**
```typescript
const [rows, setRows] = useState<CaseRow[]>([]);           // All cases
const [loading, setLoading] = useState(true);              // Loading state
const [error, setError] = useState<string | null>(null);   // Error message
const [filterPriority, setFilterPriority] = useState('all');// Filter by risk tier
const [filterStatus, setFilterStatus] = useState('all');   // Filter by status
const [sortKey, setSortKey] = useState('daysElapsed');     // Sort column
const [sortAsc, setSortAsc] = useState(false);             // Sort direction
const [search, setSearch] = useState('');                  // Search query
const [selectedId, setSelectedId] = useState(null);        // Selected row (unused)
const [hoveredRow, setHoveredRow] = useState(null);        // Hover for tooltip
```

---

## 🎨 User Interface

### Table Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                       Case Overview                             │
│  Monitor and manage all open cases across priority levels...    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐
│ Search       │ │ Priority ▼   │ │ Status ▼     │ │ 3 of 3 ★   │
└──────────────┘ └──────────────┘ └──────────────┘ └────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PRIORITY ↕  │ CASE ↕         │ STATUS  │ CREATED │ DAYS ELAPSED │
├──────────────────────────────────────────────────────────────────┤
│ ● REGULATORY │ Orion Exports… │ Open    │ 07/26   │ ████░░░ 5d  │
│ ● MEDIUM     │ TechVenture… │ In Rev… │ 07/19   │ ██░░░░░ 12d │
│ ● LOW        │ Global Trade… │ Resol… │ 06/15   │ ███░░░░ 45d │
└──────────────────────────────────────────────────────────────────┘
```

### Hover Tooltip

When you hover over a case row:

```
┌────────────────────────────────────┐
│ Joule Analysis:                    │
│                                    │
│ Rapid multi-hop transfer detected: │
│ 4 transfers within 31 minutes;     │
│ 6.2× customer baseline...          │
│                                    │
│ (tooltip appears above row)        │
└────────────────────────────────────┘
```

---

## 📊 Data Model

### CaseRow Type

```typescript
interface CaseRow {
  id: string;                    // Unique case ID
  priority: Priority;            // 'low' | 'medium' | 'overdue' | 'regulatory'
  caseName: string;              // Displayed in table
  caseId: string;                // Reference ID
  createdDate: string;           // MM/DD/YYYY
  daysElapsed: number;           // Days since creation
  status: Status;                // 'Open' | 'In Review' | 'Resolved' | etc.
  description: string;           // Case summary (unused in table)
  jouleExplanation: string;      // Shown in hover tooltip
  riskScore: number;             // 0-100
  riskTier: string;              // 'LOW' | 'MEDIUM' | 'HIGH'
  company: string;               // Company name
  transactionId: string;         // Transaction/alert ID
}
```

### Data Mapping (from `/api/cases`)

| API Field | Display Field | Example |
|-----------|---------------|---------|
| `legalName` | `caseName` | "Orion Exports Pte Ltd" |
| `transactionId` | shown as subtext | "TXN-2024-0847" |
| `riskTier` | `priority` (mapped) | HIGH → regulatory |
| `status` | `status` | "Open" |
| `createdAt` | `createdDate` | "07/26/2026" |
| `daysElapsed` | `daysElapsed` | 5 |
| `jouleExplanation` | tooltip on hover | "Rapid multi-hop..." |

---

## 🎯 Features

### 1. Filtering

**Priority filter:**
```typescript
filterPriority: 'low' | 'medium' | 'overdue' | 'regulatory' | 'all'
```
- Default: 'all' (hides closed cases)
- Updates table in real-time (client-side)

**Status filter:**
```typescript
filterStatus: 'Open' | 'In Review' | 'Pending' | 'Escalated' | 'Resolved' | 'Closed' | 'all'
```
- Default: 'all'
- Combined with priority filter (AND logic)

### 2. Searching

```typescript
search: string  // User input
```
- Searches across: caseName, caseId
- Case-insensitive
- Real-time (no API call)

### 3. Sorting

**Sortable columns:**
- `priority` — by risk tier order (REGULATORY → OVERDUE → MEDIUM → LOW → CLOSED)
- `caseName` — alphabetical
- `createdDate` — chronological
- `daysElapsed` — numeric

**Sort direction:** Ascending (↑) or Descending (↓)

**Default:** Sort by `daysElapsed` descending (oldest cases first)

### 4. Joule Tooltips

**Trigger:** Hover over any case row

**Content:** Shows `jouleExplanation` field (AI-generated case note)

**Styling:**
- Black background (`bg-[#1d2d3e]`)
- White text
- Positioned above row (bottom-full)
- Max width: 32rem
- Arrow pointer below tooltip

**Current data:** Hardcoded in mock data

**Future:** Will load from `JOULE_EXPLANATIONS_*.csv`

### 5. Priority Escalation

**In-place dropdown:**
- Click the priority dot/badge in a row
- Select new priority level
- Updates row state (no API call in MVP)

**Mapping:**
```
low ← LOW risk_tier
medium ← MEDIUM risk_tier
overdue ← ??? (currently unused, will map to overdue SLA alerts)
regulatory ← HIGH risk_tier
closed ← resolution
```

---

## 🔄 Data Flow

### On Mount

```
1. CaseTable component renders
2. useEffect runs:
   - fetch('/api/cases')
   - setLoading(true)
3. API responds with:
   {
     success: true,
     count: 3,
     cases: [
       { caseId: 'CASE-001', legalName: 'Orion...', riskTier: 'HIGH', ... },
       ...
     ]
   }
4. Transform API data → CaseRow[] format
5. setRows(transformed)
6. setLoading(false)
```

### On Filter/Sort/Search

```
1. User changes filter/sort/search dropdown or input
2. setState(...) updates React state
3. filtered array is computed (line ~370):
   rows.filter(...).sort(...) 
4. Table re-renders with new data
5. No API call (all filtering is client-side)
```

### On Hover

```
1. onMouseEnter on table row
2. setHoveredRow(row.id)
3. Conditional render checks: hoveredRow === row.id && row.jouleExplanation
4. Tooltip div appears (positioned absolutely)
5. onMouseLeave clears hoveredRow
```

---

## 🛠️ Styling (Tailwind + Fiori Colors)

### Color Palette

**Priority levels:**
```css
low: dot: #188918 (green), badge: bg-[#f0faf0] text-[#188918]
medium: dot: #e76500 (orange), badge: bg-[#fff4e0] text-[#e76500]
overdue: dot: #aa0808 (red), badge: bg-[#ffeaea] text-[#aa0808]
regulatory: dot: #6912d6 (purple), badge: bg-[#f5edff] text-[#6912d6]
closed: dot: #8c9cb0 (gray), badge: bg-[#f0f2f5] text-[#8c9cb0]
```

**Status levels:**
```css
Open: bg-[#eaf4ff] text-[#0070f2] (light blue)
In Review: bg-[#fff4e0] text-[#e76500] (light orange)
Pending: bg-[#f5f6f7] text-[#6a7d8f] (light gray)
Escalated: bg-[#ffeaea] text-[#aa0808] (light red)
Resolved: bg-[#f0faf0] text-[#188918] (light green)
Closed: bg-[#f0f2f5] text-[#8c9cb0] (light gray)
```

**Backgrounds:**
```css
Body: #f5f6f7 (Fiori light gray)
Card: #ffffff (white)
Row hover: #eaf4ff (Fiori light blue)
Alternating rows: white / #fafbfc (very light gray)
Tooltip: #1d2d3e (dark blue-gray) with white text
```

---

## 📝 Component API

### Props
None — component is fully self-contained

### State Setters

```typescript
setRows(rows)           // Update case list
setLoading(bool)        // Show/hide loading spinner
setError(msg)           // Show error message
setFilterPriority(p)    // Filter by priority
setFilterStatus(s)      // Filter by status
setSortKey(k)           // Set sort column
setSortAsc(bool)        // Set sort direction
setSearch(q)            // Update search query
setHoveredRow(id)       // Hover tooltip
```

### Event Handlers

```typescript
handleSort(key)                    // Click column header to sort
handlePriorityChange(id, priority) // Change priority in-place
(no closeCase, escalate handlers yet)
```

---

## 🔌 API Integration

### GET /api/cases

**Request:**
```
GET http://localhost:3000/api/cases
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "cases": [
    {
      "caseId": "CASE-001",
      "caseNumber": "SAP-2024-001",
      "companyId": "CMPNY-123",
      "legalName": "Orion Exports Pte Ltd",
      "transactionId": "TXN-2024-0847",
      "alertId": "ALERT-001",
      "status": "Open",
      "createdAt": "2026-07-25T17:54:24.020Z",
      "daysElapsed": 5,
      "amount": 247500,
      "jouleExplanation": "Rapid multi-hop transfer detected...",
      "riskScore": 87,
      "riskTier": "HIGH",
      "assignedQueue": "ESCALATE",
      "queueScore": 85.5,
      "reasonCodes": [...]
    },
    ...
  ]
}
```

**Error response:**
```json
{
  "error": "Failed to load cases"
}
```

---

## 🚀 Performance Notes

- **Rendering:** ~3–50 cases, no virtualization (acceptable for MVP)
- **Sorting:** O(n log n), happens in-memory on every sort change
- **Filtering:** O(n), happens for every keystroke in search
- **Memory:** ~500 rows × 20 fields ≈ 100KB (minimal)

**Optimization roadmap (if needed):**
1. Virtualize table rows (if > 500 cases)
2. Debounce search input (if lag on keystroke)
3. Memoize filtered/sorted results (React.useMemo)
4. Lazy-load case details on click

---

## 🐛 Known Issues & TODOs

### Known Issues
- ❌ **No persistence:** Clicking "Escalate" updates state only; no API call to save
- ❌ **No case detail view:** Clicking a row highlights it but doesn't open a panel
- ❌ **Export button:** Exists but does nothing
- ❌ **No pagination:** Assumes < 100 cases

### TODOs
- [ ] Connect real CSV data (replace mock in `/api/cases`)
- [ ] Add database persistence for case actions
- [ ] Implement case detail modal with full risk breakdown
- [ ] Add SAR filing workflow
- [ ] Implement Joule Q&A panel (ask questions about specific case)
- [ ] Add audit logging for all actions
- [ ] Implement case reassignment/assignment flow

---

## 🧪 Testing the Component

### Manual Test Checklist

1. **Load page:**
   - Navigate to http://localhost:3000
   - Click "Cases" nav button
   - Table should render with 3 mock cases ✓

2. **Sort:**
   - Click "PRIORITY" header → sorts by priority ✓
   - Click again → reverses sort ✓
   - Click "DAYS ELAPSED" header → sorts by days ✓

3. **Filter:**
   - Select "High Priority (Regulatory)" from Priority dropdown → shows only 1 case ✓
   - Reset to "All Priorities" → shows all 3 ✓
   - Select "Resolved" from Status dropdown → shows only resolved cases ✓

4. **Search:**
   - Type "Orion" in search box → filters to "Orion Exports" case ✓
   - Type "CASE-002" → filters to that case ✓
   - Clear search → shows all ✓

5. **Hover Tooltip:**
   - Move mouse over "Orion Exports" row → black tooltip appears above ✓
   - Tooltip shows: "Rapid multi-hop transfer detected..." ✓
   - Move mouse away → tooltip disappears ✓

6. **Priority Escalation:**
   - Click the dot/badge in the Priority column → dropdown appears ✓
   - Select new priority → row updates immediately ✓

### Automated Testing (Unit Tests)

Currently: None. Future candidates:
- Test filtering logic (priority, status, search)
- Test sorting logic (ascending/descending)
- Test data transformation (API response → CaseRow)
- Test hover tooltip visibility toggle

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main layout + view router (delegates to CaseTable) |
| `app/globals.css` | Tailwind config + Fiori colors |
| `app/api/cases/route.ts` | Data source for cases |
| `../docs/v2-scoring-plan.md` | Scoring logic behind risk_tier |
| `../docs/ARCHITECTURE.md` | System design context |

---

## 📖 Example: Adding a New Column

To add a new column to the table (e.g., "Company ID"):

1. **Update CaseRow type:**
   ```typescript
   interface CaseRow {
     companyId: string;  // Add this
     ...
   }
   ```

2. **Update API mock data** in `app/api/cases/route.ts`:
   ```typescript
   {
     companyId: "CMPNY-123",  // Add this
     ...
   }
   ```

3. **Add table header** in `CaseTable.tsx` (around line ~290):
   ```typescript
   <th className="...">Company ID</th>
   ```

4. **Add table cell** (around line ~340):
   ```typescript
   <td className="px-4 py-2.5 text-xs">{row.companyId}</td>
   ```

5. **Optionally make sortable:**
   ```typescript
   type SortKey = 'priority' | 'caseName' | 'companyId' | ...
   
   // In sort handler:
   if (sortKey === 'companyId') cmp = a.companyId.localeCompare(b.companyId)
   ```

6. **Test:** `npm run dev` → http://localhost:3000/cases → Check new column appears

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Table shows "Loading..." forever | Check `/api/cases` returns data: `curl http://localhost:3000/api/cases` |
| Tooltip doesn't appear on hover | Verify `jouleExplanation` is truthy in mock data |
| Sorting doesn't work | Check `handleSort()` function; ensure `sortKey` is in PRIORITY_ORDER |
| CSS looks broken | Run `npm install` + restart dev server |
| Rows don't filter | Check filter state; verify filtering logic in `filtered` array computation |

---

## 💡 Pro Tips

1. **Inspect state:** Add `console.log(rows, filterPriority, sortKey)` in render to debug
2. **Test API:** Use `curl http://localhost:3000/api/cases | jq` to inspect data
3. **DevTools:** Use React DevTools to inspect component state / props
4. **CSS tweaks:** All colors are in `PRIORITY_STYLES` and `STATUS_STYLES` dicts at top of file
5. **Performance:** Check browser DevTools Performance tab if table gets slow with 100+ rows

---

**Last updated:** 2026-07-31  
**Maintained by:** Marcus (Frontend)
