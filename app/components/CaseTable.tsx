'use client';

import { useState } from 'react';
import type { CaseRecord, DisplayStatus, Priority } from '@/app/lib/cases';
import { PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_STYLES, STATUS_STYLES, displayStatus, formatUsd } from '@/app/lib/cases';

export interface CaseFilters {
  priority: Priority | 'all';
  status: DisplayStatus | 'all';
  search: string;
}

interface CaseTableProps {
  rows: CaseRecord[];
  filters: CaseFilters;
  onFilterChange: (filters: Partial<CaseFilters>) => void;
  onRowSelect: (caseId: string) => void;
  onCloseCase?: (caseId: string) => void;
  onReopenCase?: (caseId: string) => void;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLES[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded ${s.badge}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`inline-block px-2 py-0.5 text-xs font-medium border rounded ${STATUS_STYLES[status]}`}>{status}</span>;
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 60 ? '#aa0808' : score >= 30 ? '#e76500' : '#188918';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#e8eaec] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-[#1d2d3e]">{score}</span>
    </div>
  );
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  return <span className="ml-1 opacity-50 text-xs">{active ? (asc ? '↑' : '↓') : '↕'}</span>;
}

type SortKey = 'priority' | 'legalName' | 'riskScore' | 'queueScore' | 'daysElapsed';

const PRIORITY_FILTER_OPTIONS: Array<{ value: Priority | 'all'; label: string }> = [
  { value: 'all', label: 'All Priorities' },
  { value: 'low', label: 'Low Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'overdue', label: 'High Priority (Overdue)' },
  { value: 'regulatory', label: 'High Priority (Regulatory)' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_FILTER_OPTIONS: Array<{ value: DisplayStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'Escalated', label: 'Escalated' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'Auto-Clear', label: 'Auto-Clear' },
  { value: 'Data Chase', label: 'Data Chase' },
  { value: 'Closed', label: 'Closed' },
];

export default function CaseTable({ rows, filters, onFilterChange, onRowSelect }: CaseTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('queueScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = rows
    .filter((r) => (filters.priority === 'all' ? r.priority !== 'closed' : r.priority === filters.priority))
    .filter((r) => filters.status === 'all' || displayStatus(r) === filters.status)
    .filter((r) => {
      if (!filters.search) return true;
      const q = filters.search.toLowerCase();
      return r.legalName.toLowerCase().includes(q) || r.caseNumber.toLowerCase().includes(q) || r.caseId.includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === 'legalName') cmp = a.legalName.localeCompare(b.legalName);
      else cmp = a[sortKey] - b[sortKey];
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Array<{ key: SortKey; label: string }> = [
    { key: 'priority', label: 'Priority' },
    { key: 'legalName', label: 'Case' },
    { key: 'riskScore', label: 'Risk' },
    { key: 'queueScore', label: 'Queue Score' },
    { key: 'daysElapsed', label: 'Age' },
  ];

  return (
    <div className="bg-white border border-[#d9dbdd] rounded-[4px] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#d9dbdd] flex flex-wrap items-center gap-3 bg-[#f5f6f7]">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6a7d8f]" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder={rows.length > 0 ? "Search cases…" : "0 cases loaded (Engine Standby)"}
            value={filters.search}
            onChange={(e) => {
              onFilterChange({ search: e.target.value });
              setPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#d9dbdd] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 focus:border-[#0070f2] bg-white transition"
          />
        </div>

        <select
          value={filters.priority}
          onChange={(e) => {
            onFilterChange({ priority: e.target.value as Priority | 'all' });
            setPage(1);
          }}
          className="appearance-none pl-3 pr-8 py-1.5 text-xs border border-[#d9dbdd] rounded focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 focus:border-[#0070f2] bg-[#f5f6f7] text-[#1d2d3e] cursor-pointer shadow-2xs transition"
          style={{
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {PRIORITY_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => {
            onFilterChange({ status: e.target.value as DisplayStatus | 'all' });
            setPage(1);
          }}
          className="appearance-none pl-3 pr-8 py-1.5 text-xs border border-[#d9dbdd] rounded focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 focus:border-[#0070f2] bg-[#f5f6f7] text-[#1d2d3e] cursor-pointer shadow-2xs transition"
          style={{
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex-1" />
        <span className="text-xs text-[#6a7d8f] tabular-nums">
          {filtered.length} of {rows.length} cases
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#f5f6f7] border-b border-[#d9dbdd]">
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-[#1d2d3e] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-[#0070f2] transition-colors"
                  onClick={() => handleSort(key)}
                >
                  {label} <SortIcon active={sortKey === key} asc={sortAsc} />
                </th>
              ))}
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#1d2d3e] uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#1d2d3e] uppercase tracking-wider whitespace-nowrap">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#6a7d8f] bg-[#fafbfc]">
                  <div className="text-[#1d2d3e] font-bold text-sm mb-1">No cases loaded (Engine Standby)</div>
                  <div className="text-xs text-[#6a7d8f] max-w-md mx-auto">
                    Screening engine is currently standby. Click &quot;▶ RUN SCREENING PIPELINE&quot; on the Dashboard tab to populate corporate entity cases.
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#6a7d8f]">
                  No cases match the current filter.
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={row.caseId}
                  onClick={() => onRowSelect(row.caseId)}
                  className={`border-b border-[#eaecee] hover:bg-[#eaf4ff] transition-colors cursor-pointer ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                  } ${row.priority === 'closed' ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#1d2d3e] text-sm leading-tight">{row.legalName}</div>
                    <div className="text-xs text-[#6a7d8f] font-mono mt-0.5">
                      {row.caseNumber} · {row.caseType ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <RiskBar score={row.riskScore} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#1d2d3e] tabular-nums font-mono">{row.queueScore}</td>
                  <td className="px-4 py-2.5 text-xs text-[#1d2d3e] tabular-nums font-mono whitespace-nowrap">{row.daysElapsed}d</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={displayStatus(row)} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#1d2d3e] tabular-nums whitespace-nowrap">{formatUsd(row.amountUsd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#d9dbdd] flex items-center justify-between text-xs text-[#6a7d8f] bg-[#fafbfc]">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="appearance-none pl-2.5 pr-7 py-1 border border-[#d9dbdd] rounded bg-white text-[#1d2d3e] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 focus:border-[#0070f2] transition"
              style={{
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
              }}
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={250}>250 per page</option>
              <option value={Math.max(100000, rows.length)}>All ({filtered.length})</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page <span className="font-semibold text-[#1d2d3e]">{currentPage}</span> of{' '}
              <span className="font-semibold text-[#1d2d3e]">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-[#d9dbdd] rounded bg-white hover:bg-[#f5f6f7] disabled:opacity-40 disabled:cursor-not-allowed text-[#1d2d3e] font-medium transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-[#d9dbdd] rounded bg-white hover:bg-[#f5f6f7] disabled:opacity-40 disabled:cursor-not-allowed text-[#1d2d3e] font-medium transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
