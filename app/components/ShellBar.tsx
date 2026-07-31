'use client';

export type NavTab =
  | 'Dashboard & Pipeline'
  | 'Cases & Alerts'
  | 'Rules & Analytics'
  | 'Home'
  | 'Cases'
  | 'Alerts'
  | 'Reports'
  | 'Admin';

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'Dashboard & Pipeline', label: 'Dashboard & Pipeline' },
  { id: 'Cases & Alerts', label: 'Cases & Alerts' },
  { id: 'Rules & Analytics', label: 'Rules & Analytics' },
];

interface ShellBarProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export default function ShellBar({ activeTab = 'Cases', onTabChange }: ShellBarProps) {
  return (
    <header className="flex items-center h-12 px-4 bg-[#354A5E] text-white text-sm shrink-0">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5 mr-8 cursor-pointer select-none" onClick={() => onTabChange?.('Home')}>
        <div className="flex items-center justify-center w-7 h-7 rounded-[4px] bg-[#0070F2] text-white font-bold text-xs">
          SAP
        </div>
        <span className="font-semibold tracking-wide text-white text-sm">SAP Case Management</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-4 flex-1 h-full" aria-label="Primary">
        {NAV_ITEMS.map(({ id, label }) => {
          const active =
            activeTab === id ||
            (id === 'Dashboard & Pipeline' && (activeTab === 'Home' || activeTab === 'Admin')) ||
            (id === 'Cases & Alerts' && (activeTab === 'Cases' || activeTab === 'Alerts')) ||
            (id === 'Rules & Analytics' && activeTab === 'Reports');
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange?.(id)}
              className={`h-full flex items-center px-2 text-xs font-medium select-none transition-colors cursor-pointer focus:outline-none ${
                active
                  ? 'border-b-2 border-white font-bold text-white'
                  : 'border-b-2 border-transparent text-white/70 hover:text-white hover:border-white/40'
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* User Avatar */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-[4px] bg-[#0070F2] text-white text-xs font-semibold shrink-0 cursor-pointer"
        title="Julian Miller (Lead Investigator)"
      >
        JM
      </div>
    </header>
  );
}
