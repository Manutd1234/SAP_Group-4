'use client';

import type { Priority } from '@/app/lib/cases';
import { PRIORITY_STYLES } from '@/app/lib/cases';

const TILES: Array<{ key: Priority; label: string }> = [
  { key: 'low', label: 'Low Priority' },
  { key: 'medium', label: 'Medium Priority' },
  { key: 'overdue', label: 'High Priority — Overdue' },
  { key: 'regulatory', label: 'High Priority — Regulatory' },
  { key: 'closed', label: 'Closed' },
];

interface KpiTilesProps {
  counts: Record<Priority, number>;
  active: Priority | null;
  onToggle: (priority: Priority) => void;
}

export default function KpiTiles({ counts, active, onToggle }: KpiTilesProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      {TILES.map(({ key, label }) => {
        const isActive = active === key;
        const style = PRIORITY_STYLES[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={isActive}
            className={`text-left p-4 rounded border bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0070f2]/40 ${
              isActive ? 'border-[#0070f2] ring-2 ring-[#0070f2]/30' : 'border-[#d9dbdd] hover:border-[#0070f2]/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden="true" />
              <span className="text-xs font-medium text-[#6a7d8f] uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-2xl font-bold text-[#1d2d3e] tabular-nums">{counts[key] ?? 0}</div>
          </button>
        );
      })}
    </div>
  );
}
