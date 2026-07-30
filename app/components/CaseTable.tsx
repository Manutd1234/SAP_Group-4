'use client';

import { useState, useEffect } from 'react';

type Priority = 'low' | 'medium' | 'overdue' | 'regulatory' | 'closed';
type Status = 'Open' | 'In Review' | 'Pending' | 'Escalated' | 'Resolved' | 'Closed';

interface CaseRow {
  id: string;
  priority: Priority;
  caseName: string;
  caseId: string;
  createdDate: string;
  daysElapsed: number;
  status: Status;
  description: string;
  jouleExplanation?: string;
  riskScore?: number;
  riskTier?: string;
  company?: string;
  transactionId?: string;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low Priority',
  medium: 'Medium Priority',
  overdue: 'High Priority (Overdue)',
  regulatory: 'High Priority (Regulatory)',
  closed: 'Closed',
};

const PRIORITY_STYLES: Record<Priority, { dot: string; badge: string; text: string }> = {
  low: { dot: 'bg-[#188918]', badge: 'bg-[#f0faf0] text-[#188918] border-[#b8e0b8]', text: 'text-[#188918]' },
  medium: { dot: 'bg-[#e76500]', badge: 'bg-[#fff4e0] text-[#e76500] border-[#f5c87a]', text: 'text-[#e76500]' },
  overdue: { dot: 'bg-[#aa0808]', badge: 'bg-[#ffeaea] text-[#aa0808] border-[#f5b8b8]', text: 'text-[#aa0808]' },
  regulatory: { dot: 'bg-[#6912d6]', badge: 'bg-[#f5edff] text-[#6912d6] border-[#d4b3f5]', text: 'text-[#6912d6]' },
  closed: { dot: 'bg-[#8c9cb0]', badge: 'bg-[#f0f2f5] text-[#8c9cb0] border-[#c8d0d8]', text: 'text-[#8c9cb0]' },
};

const STATUS_STYLES: Record<Status, string> = {
  Open: 'bg-[#eaf4ff] text-[#0070f2] border-[#b3d4f5]',
  'In Review': 'bg-[#fff4e0] text-[#e76500] border-[#f5c87a]',
  Pending: 'bg-[#f5f6f7] text-[#6a7d8f] border-[#d9dbdd]',
  Escalated: 'bg-[#ffeaea] text-[#aa0808] border-[#f5b8b8]',
  Resolved: 'bg-[#f0faf0] text-[#188918] border-[#b8e0b8]',
  Closed: 'bg-[#f0f2f5] text-[#8c9cb0] border-[#c8d0d8]',
};

function PrioritySelect({ value, onChange }: { value: Priority; onChange: (v: Priority) => void }) {
  const s = PRIORITY_STYLES[value];
  return (
    <div className="relative inline-flex items-center">
      <span className={`absolute left-2.5 w-2 h-2 rounded-full ${s.dot} pointer-events-none z-10`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Priority)}
        onClick={(e) => e.stopPropagation()}
        className={`pl-6 pr-7 py-1 text-xs font-medium border rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 transition-colors ${s.badge}`}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
      >
        <option value="low">Low Priority</option>
        <option value="medium">Medium Priority</option>
        <option value="overdue">High Priority (Overdue)</option>
        <option value="regulatory">High Priority (Regulatory)</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium border rounded ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function DaysElapsedBar({ days }: { days: number }) {
  const pct = Math.min((days / 120) * 100, 100);
  const color = days > 90 ? '#aa0808' : days > 45 ? '#e76500' : '#0070f2';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-[#e8eaec] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-[#1d2d3e]">{days}d</span>
    </div>
  );
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  return <span className="ml-1 opacity-50 text-xs">{active ? (asc ? '↑' : '↓') : '↕'}</span>;
}

type SortKey = 'priority' | 'caseName' | 'createdDate' | 'daysElapsed';
const PRIORITY_ORDER: Record<Priority, number> = { regulatory: 0, overdue: 1, medium: 2, low: 3, closed: 4 };

export default function CaseTable() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('daysElapsed');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cases');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (!data.cases) throw new Error('No cases in response');

        // Transform API response to CaseRow format
        const transformed: CaseRow[] = data.cases.map((c: any) => ({
          id: c.caseId,
          priority: c.riskTier === 'HIGH' ? 'regulatory' : c.riskTier === 'MEDIUM' ? 'medium' : 'low',
          caseName: `${c.legalName} - ${c.caseNumber}`,
          caseId: c.caseNumber,
          createdDate: new Date(c.createdAt).toLocaleDateString(),
          daysElapsed: c.daysElapsed,
          status: (c.status || 'Open') as Status,
          description: c.jouleExplanation || `Risk Score: ${c.riskScore}, Queue: ${c.assignedQueue}`,
          jouleExplanation: c.jouleExplanation || null,
          riskScore: c.riskScore,
          riskTier: c.riskTier,
          company: c.legalName,
          transactionId: c.transactionId,
        }));

        setRows(transformed);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load cases');
        console.error('Error loading cases:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePriorityChange = (id: string, priority: Priority) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, priority } : r)));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const activePriorityKeys: Priority[] = ['low', 'medium', 'overdue', 'regulatory'];
  const counts: Record<Priority, number> = { low: 0, medium: 0, overdue: 0, regulatory: 0, closed: 0 };
  rows.forEach((r) => counts[r.priority]++);

  const PRIORITY_FILTER_OPTIONS: Array<{ value: Priority | 'all'; label: string }> = [
    { value: 'all', label: 'All Priorities' },
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'overdue', label: 'High Priority (Overdue)' },
    { value: 'regulatory', label: 'High Priority (Regulatory)' },
    { value: 'closed', label: 'Closed' },
  ];

  const STATUS_FILTER_OPTIONS: Array<{ value: Status | 'all'; label: string }> = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Open', label: 'Open' },
    { value: 'Escalated', label: 'Escalated' },
    { value: 'In Review', label: 'In Review' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Closed', label: 'Closed' },
  ];

  const filtered = rows
    .filter((r) => {
      if (filterPriority === 'all') return r.priority !== 'closed';
      return r.priority === filterPriority;
    })
    .filter((r) => filterStatus === 'all' || r.status === filterStatus)
    .filter((r) =>
      search === '' ||
      r.caseName.toLowerCase().includes(search.toLowerCase()) ||
      r.caseId.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === 'caseName') cmp = a.caseName.localeCompare(b.caseName);
      else if (sortKey === 'createdDate') cmp = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
      else if (sortKey === 'daysElapsed') cmp = a.daysElapsed - b.daysElapsed;
      return sortAsc ? cmp : -cmp;
    });

  if (loading) return <div className="text-center py-8 text-[#6a7d8f]">Loading cases...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error: {error}</div>;

  return (
    <div className="bg-white border border-[#d9dbdd] rounded shadow-sm">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-[#d9dbdd] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6a7d8f]" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#d9dbdd] rounded focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 focus:border-[#0070f2] bg-[#f5f6f7] transition"
          />
        </div>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
          className="pl-3 pr-8 py-1.5 text-xs border border-[#d9dbdd] rounded focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 bg-[#f5f6f7] text-[#1d2d3e] cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {PRIORITY_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as Status | 'all')}
          className="pl-3 pr-8 py-1.5 text-xs border border-[#d9dbdd] rounded focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 bg-[#f5f6f7] text-[#1d2d3e] cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex-1" />
        <span className="text-xs text-[#6a7d8f] tabular-nums">{filtered.length} of {rows.length} cases</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#f5f6f7] border-b border-[#d9dbdd]">
              {(
                [
                  { key: 'priority' as SortKey, label: 'Priority' },
                  { key: 'caseName' as SortKey, label: 'Case' },
                ]
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-[#1d2d3e] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-[#0070f2] transition-colors"
                  onClick={() => handleSort(key)}
                >
                  {label} <SortIcon active={sortKey === key} asc={sortAsc} />
                </th>
              ))}
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#1d2d3e] uppercase tracking-wider whitespace-nowrap">Status</th>
              {(
                [
                  { key: 'createdDate' as SortKey, label: 'Created' },
                  { key: 'daysElapsed' as SortKey, label: 'Days Elapsed' },
                ]
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-[#1d2d3e] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-[#0070f2] transition-colors"
                  onClick={() => handleSort(key)}
                >
                  {label} <SortIcon active={sortKey === key} asc={sortAsc} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr
                key={row.id}
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
                className={`border-b border-[#eaecee] hover:bg-[#eaf4ff] transition-colors cursor-pointer relative ${idx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'} ${row.priority === 'closed' ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <PrioritySelect value={row.priority} onChange={(v) => handlePriorityChange(row.id, v)} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#1d2d3e] text-sm leading-tight">{row.caseName}</div>
                  <div className="text-xs text-[#6a7d8f] font-mono mt-0.5">
                    {row.caseId} · {row.transactionId}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2.5 text-xs text-[#1d2d3e] tabular-nums whitespace-nowrap font-mono">{row.createdDate}</td>
                <td className="px-4 py-2.5">
                  <DaysElapsedBar days={row.daysElapsed} />
                </td>

                {/* Joule Explanation Tooltip */}
                {hoveredRow === row.id && row.jouleExplanation && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full -mb-2 z-40 bg-[#1d2d3e] text-white rounded shadow-lg p-3 max-w-xs text-xs leading-relaxed pointer-events-none">
                    <p className="font-semibold mb-1">Joule Analysis:</p>
                    <p>{row.jouleExplanation}</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#1d2d3e]" />
                  </div>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#6a7d8f]">
                  No cases match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-[#d9dbdd] flex items-center justify-between bg-[#fafbfc]">
        <span className="text-xs text-[#6a7d8f]">Last refreshed: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <button className="text-xs text-[#0070f2] hover:underline focus:outline-none">Export as CSV</button>
      </div>
    </div>
  );
}
