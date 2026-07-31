const NAV_ITEMS = ['Home', 'Cases', 'Alerts', 'Reports', 'Admin'];

export default function ShellBar() {
  return (
    <header className="flex items-center h-12 px-4 bg-[#354a5e] text-white text-sm shrink-0">
      <div className="flex items-center gap-2 mr-8">
        <span className="flex items-center justify-center w-7 h-7 rounded bg-[#0070f2] font-bold text-xs" aria-hidden="true">
          S4
        </span>
        <span className="font-semibold tracking-wide whitespace-nowrap">SAP Case Management</span>
      </div>

      <nav className="flex items-center gap-6 flex-1 h-full" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = item === 'Cases';
          return (
            <span
              key={item}
              aria-hidden="true"
              className={`h-full flex items-center select-none ${
                active ? 'border-b-2 border-white font-medium' : 'text-white/70'
              }`}
            >
              {item}
            </span>
          );
        })}
      </nav>

      <div
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0070f2] text-xs font-semibold shrink-0"
        aria-hidden="true"
      >
        JM
      </div>
    </header>
  );
}
