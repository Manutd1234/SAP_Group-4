'use client';

import type { Priority } from '@/app/lib/cases';

interface TileSpec {
  key: Priority;
  label: string;
  badge: string;
  badgeColor: string;
}

const TILES: TileSpec[] = [
  {
    key: 'regulatory',
    label: 'Regulatory High Risk',
    badge: 'Sanctions & PEP',
    badgeColor: 'text-[#BB0000] bg-[#FFF0F0] border-[#FFCACA]',
  },
  {
    key: 'overdue',
    label: 'High Priority (Overdue)',
    badge: 'SLA Breached',
    badgeColor: 'text-[#E9730C] bg-[#FFF5EC] border-[#FFD8B3]',
  },
  {
    key: 'medium',
    label: 'Medium Priority',
    badge: 'Standard Queue',
    badgeColor: 'text-[#E9730C] bg-[#FFF9F0] border-[#FFE2C2]',
  },
  {
    key: 'low',
    label: 'Low Priority / Auto-Clear',
    badge: 'High Confidence',
    badgeColor: 'text-[#107E3E] bg-[#F0F9F3] border-[#C3E8CE]',
  },
  {
    key: 'closed',
    label: 'Closed Cases',
    badge: 'Resolved',
    badgeColor: 'text-[#6A6D70] bg-[#F5F6F7] border-[#D9DBDDE5]',
  },
];

interface KpiTilesProps {
  counts: Record<Priority, number>;
  activePriority?: Priority | null;
  active?: Priority | null;
  onSelectPriority?: (priority: Priority) => void;
  onToggle?: (priority: Priority) => void;
}

export default function KpiTiles({
  counts,
  activePriority,
  active,
  onSelectPriority,
  onToggle,
}: KpiTilesProps) {
  const currentActive = activePriority !== undefined ? activePriority : active !== undefined ? active : null;

  const handleTileClick = (key: Priority) => {
    if (onSelectPriority) {
      onSelectPriority(key);
    } else if (onToggle) {
      onToggle(key);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {TILES.map(({ key, label, badge, badgeColor }) => {
        const isActive = currentActive === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleTileClick(key)}
            aria-pressed={isActive}
            className={`text-left p-3.5 rounded-[4px] bg-white border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0070F2] ${
              isActive
                ? 'border-[#0070F2] ring-1 ring-[#0070F2]'
                : 'border-[#D9DBDDE5] hover:border-[#0070F2]'
            }`}
          >
            <div className="text-[11px] font-semibold text-[#6A6D70] uppercase tracking-wide truncate mb-1">
              {label}
            </div>
            <div className="text-2xl font-bold text-[#1D2D3E] tabular-nums mb-2">
              {counts[key] ?? 0}
            </div>
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-[2px] border ${badgeColor}`}>
              {badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
