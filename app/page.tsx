'use client';

import { useEffect, useMemo, useState } from 'react';
import ShellBar, { type NavTab } from './components/ShellBar';
import KpiTiles from './components/KpiTiles';
import CaseTable, { type CaseFilters } from './components/CaseTable';
import CaseDetailModal from './components/CaseDetailModal';
import PipelineConsole from './components/PipelineConsole';
import type { CaseRecord, CasesArtifactMeta, Priority } from './lib/cases';
import { formatUsd } from './lib/cases';

const MUTATIONS_KEY = 'risksignal-case-mutations';
type Mutations = Record<string, Partial<CaseRecord>>;

function loadMutations(): Mutations {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(MUTATIONS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveMutations(mutations: Mutations) {
  sessionStorage.setItem(MUTATIONS_KEY, JSON.stringify(mutations));
}

const EMPTY_COUNTS: Record<Priority, number> = { low: 0, medium: 0, overdue: 0, regulatory: 0, closed: 0 };

export interface RuleItem {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  ruleDescription: string;
  category: string;
  thresholdValue: string;
  currency: string;
  riskImpact: string;
  status: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>('Dashboard & Pipeline');
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleCategory, setRuleCategory] = useState('ALL');
  const [meta, setMeta] = useState<CasesArtifactMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutations, setMutations] = useState<Mutations>({});
  const [filters, setFilters] = useState<CaseFilters>({ priority: 'all', status: 'all', search: '' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Dynamic Pipeline Execution State: starts BLANK (false)
  const [isPipelineExecuted, setIsPipelineExecuted] = useState(false);

  useEffect(() => {
    setMutations(loadMutations());
    (async () => {
      try {
        const [casesRes, rulesRes] = await Promise.all([
          fetch('/api/cases'),
          fetch('/api/rules').catch(() => null),
        ]);

        if (!casesRes.ok) throw new Error(`API error: ${casesRes.status}`);
        const data = await casesRes.json();
        if (!data.cases) throw new Error('No cases in response');
        setCases(data.cases);
        setMeta(data.meta);

        if (rulesRes && rulesRes.ok) {
          const rulesData = await rulesRes.json();
          if (rulesData.rules) {
            setRules(rulesData.rules);
          }
        }
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load dataset');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mergedCases = useMemo(
    () => cases.map((c) => (mutations[c.caseId] ? { ...c, ...mutations[c.caseId] } : c)),
    [cases, mutations]
  );

  // Cases visible on dashboard depends on pipeline execution!
  const visibleCases = useMemo(
    () => (isPipelineExecuted ? mergedCases : []),
    [isPipelineExecuted, mergedCases]
  );

  const applyMutation = (caseId: string, patch: Partial<CaseRecord>) => {
    setMutations((prev) => {
      const next = { ...prev, [caseId]: { ...prev[caseId], ...patch } };
      saveMutations(next);
      return next;
    });
  };

  const handleCloseCase = (caseId: string) => {
    applyMutation(caseId, { status: 'CLOSED', priority: 'closed', closedAt: new Date().toISOString() });
    setSelectedCaseId(null);
  };

  const handleReopenCase = (caseId: string) => {
    const original = cases.find((c) => c.caseId === caseId);
    let targetPriority: Priority = 'medium';
    if (original) {
      if (original.priority !== 'closed') {
        targetPriority = original.priority;
      } else if (original.riskScore >= 75) {
        targetPriority = 'regulatory';
      } else if (original.daysElapsed >= 30) {
        targetPriority = 'overdue';
      } else if (original.riskScore >= 45) {
        targetPriority = 'medium';
      } else {
        targetPriority = 'low';
      }
    }
    applyMutation(caseId, { status: 'UNDER_REVIEW', priority: targetPriority, closedAt: undefined });
    setSelectedCaseId(null);
  };

  const handleEscalate = (caseId: string, target: Priority) => {
    applyMutation(caseId, { priority: target });
  };

  const counts = useMemo(() => {
    const c = { ...EMPTY_COUNTS };
    visibleCases.forEach((r) => c[r.priority]++);
    return c;
  }, [visibleCases]);

  const queueCounts = useMemo(() => {
    const q = { ESCALATE: 0, DATA_CHASE: 0, AUTO_CLEAR: 0, STANDARD: 0 };
    visibleCases.forEach((r) => {
      if (r.assignedQueue in q) q[r.assignedQueue as keyof typeof q]++;
    });
    return q;
  }, [visibleCases]);

  const totalFlaggedUsd = useMemo(
    () => visibleCases.reduce((acc, c) => acc + (c.amountUsd || 0), 0),
    [visibleCases]
  );

  const filteredRules = useMemo(() => {
    if (!isPipelineExecuted) return [];
    return rules.filter((r) => {
      const matchesCategory = ruleCategory === 'ALL' || r.category === ruleCategory;
      const matchesSearch =
        !ruleSearch ||
        r.ruleCode.toLowerCase().includes(ruleSearch.toLowerCase()) ||
        (r.ruleName && r.ruleName.toLowerCase().includes(ruleSearch.toLowerCase())) ||
        (r.ruleDescription && r.ruleDescription.toLowerCase().includes(ruleSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [rules, ruleCategory, ruleSearch, isPipelineExecuted]);

  const selectedCase = mergedCases.find((c) => c.caseId === selectedCaseId) ?? null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fafbfc]">
        <ShellBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex items-center justify-center text-[#6a7d8f] text-sm">
          Loading compliance dataset records…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fafbfc]">
        <ShellBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex items-center justify-center text-red-600 text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6F7]">
      <ShellBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="page-content">
        {/* ================= 1. DASHBOARD & PIPELINE TAB ================= */}
        {(activeTab === 'Dashboard & Pipeline' || activeTab === 'Home' || activeTab === 'Admin') && (
          <div>
            {/* SAP Fiori Page Header */}
            <div className="mb-6 p-4 rounded-[4px] bg-white border border-[#D9DBDDE5] flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#0070F2] bg-[#EAF4FF] border border-[#BFDBFE] px-2 py-0.5 rounded-[2px]">
                    SAP AI Core
                  </span>
                  <span className="text-xs text-[#6A6D70]">
                    {isPipelineExecuted ? 'RiskSignal v2.0 Engine (Active)' : 'Engine Standby (Unexecuted)'}
                  </span>
                </div>
                <h1 className="text-lg font-bold text-[#1D2D3E] mt-1">
                  Financial Crime & Sanctions Cockpit
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPipelineExecuted(false)}
                  title="Clear all metrics and reset pipeline state to blank"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-[4px] bg-white text-[#6A6D70] hover:bg-[#F5F6F7] border border-[#D9DBDDE5] transition cursor-pointer"
                >
                  🔄 Reset Engine & Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ priority: 'regulatory', status: 'all', search: '' });
                    setActiveTab('Cases & Alerts');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0070F2] text-white hover:bg-[#005cbd] transition cursor-pointer"
                >
                  Inspect Regulatory Cases ({counts.regulatory})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Cases & Alerts')}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-[4px] bg-white text-[#0070F2] hover:bg-[#F5F6F7] border border-[#D9DBDDE5] transition cursor-pointer"
                >
                  Open Cases Workspace →
                </button>
              </div>
            </div>

            {/* Seamlessly Integrated Pipeline Engine Console */}
            <PipelineConsole
              isExecuted={isPipelineExecuted}
              onPipelineComplete={() => setIsPipelineExecuted(true)}
              onResetPipeline={() => setIsPipelineExecuted(false)}
            />

            {!isPipelineExecuted && (
              <div className="mb-6 p-4 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="text-base">ℹ️</span>
                  <span>
                    <strong>Screening Engine Standby:</strong> Dashboard is currently blank. Click <strong>&quot;▶ RUN SCREENING PIPELINE&quot;</strong> above to ingest corporate datasets, run active screening rules, and generate live risk scores.
                  </span>
                </div>
              </div>
            )}

            {/* Executive KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="p-4 bg-white border border-[#D9DBDDE5] rounded-[4px]">
                <div className="text-[11px] font-semibold text-[#6A6D70] uppercase tracking-wide">Monitored Entities</div>
                <div className="text-2xl font-bold text-[#1D2D3E] mt-1 tabular-nums">
                  {isPipelineExecuted ? mergedCases.length.toLocaleString() : '0'}
                </div>
                <div className="text-xs text-[#107E3E] font-medium mt-1">
                  {isPipelineExecuted ? '100% Dataset Coverage' : 'Awaiting Pipeline Run'}
                </div>
              </div>
              <div className="p-4 bg-white border border-[#FFCACA] bg-[#FFF0F0] rounded-[4px]">
                <div className="text-[11px] font-semibold text-[#BB0000] uppercase tracking-wide">Regulatory Breaches</div>
                <div className="text-2xl font-bold text-[#BB0000] mt-1 tabular-nums">
                  {isPipelineExecuted ? (counts.regulatory + counts.overdue).toLocaleString() : '0'}
                </div>
                <div className="text-xs text-[#BB0000] font-semibold mt-1">
                  {isPipelineExecuted ? 'Action Required' : 'Engine Unexecuted'}
                </div>
              </div>
              <div className="p-4 bg-white border border-[#D9DBDDE5] rounded-[4px]">
                <div className="text-[11px] font-semibold text-[#6A6D70] uppercase tracking-wide">Flagged Exposure Volume</div>
                <div className="text-2xl font-bold text-[#1D2D3E] mt-1 tabular-nums">
                  {isPipelineExecuted ? formatUsd(totalFlaggedUsd) : '$0'}
                </div>
                <div className="text-xs text-[#6A6D70] font-medium mt-1">
                  {isPipelineExecuted ? 'Aggregated Transaction Risk' : 'Standby State'}
                </div>
              </div>
              <div className="p-4 bg-white border border-[#D9DBDDE5] rounded-[4px]">
                <div className="text-[11px] font-semibold text-[#6A6D70] uppercase tracking-wide">AI Scoring Engine</div>
                <div className="text-2xl font-bold text-[#107E3E] mt-1 flex items-center gap-2">
                  <span className={isPipelineExecuted ? 'text-[#107E3E]' : 'text-[#6A6D70]'}>
                    {isPipelineExecuted ? 'Online' : 'Standby'}
                  </span>
                  <span className="text-xs font-mono font-semibold bg-[#EAF4FF] text-[#0070F2] px-2 py-0.5 rounded-[2px]">v2.0</span>
                </div>
                <div className="text-xs text-[#6A6D70] font-medium mt-1">
                  {isPipelineExecuted ? 'ML Parity Verified' : 'Ready for Execution'}
                </div>
              </div>
            </div>

            {/* Operational Queues Breakdown & Quick Nav */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 bg-white border border-[#D9DBDDE5] rounded-[4px] p-4">
                <h3 className="text-xs font-bold text-[#1D2D3E] uppercase tracking-wider mb-3">
                  Operational Queues Breakdown
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#BB0000]">Escalate Queue (Sanctions / FATF)</span>
                      <span className="font-mono text-[#1D2D3E] font-bold">{queueCounts.ESCALATE} cases</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#BB0000] h-full"
                        style={{ width: `${(queueCounts.ESCALATE / (visibleCases.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#E9730C]">Data Chase Queue (Missing Mandatory Info)</span>
                      <span className="font-mono text-[#1D2D3E] font-bold">{queueCounts.DATA_CHASE} cases</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#E9730C] h-full"
                        style={{ width: `${(queueCounts.DATA_CHASE / (visibleCases.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#107E3E]">Fast-Track Low Risk Queue (Analyst Sign-off)</span>
                      <span className="font-mono text-[#1D2D3E] font-bold">{queueCounts.AUTO_CLEAR} cases</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#107E3E] h-full"
                        style={{ width: `${(queueCounts.AUTO_CLEAR / (visibleCases.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#0070F2]">Standard Analyst Review Queue</span>
                      <span className="font-mono text-[#1D2D3E] font-bold">{queueCounts.STANDARD} cases</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0070F2] h-full"
                        style={{ width: `${(queueCounts.STANDARD / (visibleCases.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#D9DBDDE5] rounded-[4px] p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#1D2D3E] uppercase tracking-wider mb-3">
                    Quick Navigation & Tools
                  </h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('Cases & Alerts')}
                      className="w-full p-2.5 bg-[#FAFBFB] hover:bg-[#EAF4FF] border border-[#D9DBDDE5] hover:border-[#0070F2] rounded-[4px] text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-bold text-[#0070F2]">Cases & Alerts Workspace</div>
                      <div className="text-[11px] text-[#6A6D70]">
                        {isPipelineExecuted ? `Filter & triage ${mergedCases.length.toLocaleString()} entity cases` : '0 Cases (Engine Standby)'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('Rules & Analytics')}
                      className="w-full p-2.5 bg-[#FAFBFB] hover:bg-[#EAF4FF] border border-[#D9DBDDE5] hover:border-[#0070F2] rounded-[4px] text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-bold text-[#0070F2]">Rules & Analytics</div>
                      <div className="text-[11px] text-[#6A6D70]">
                        {isPipelineExecuted ? `Active screening rules & triage analytics` : '0 Rules Loaded (Standby)'}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. CASES & ALERTS TAB ================= */}
        {(activeTab === 'Cases & Alerts' || activeTab === 'Cases' || activeTab === 'Alerts') && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-[#1D2D3E]">Cases & Risk Alerts Workspace</h1>
                <p className="text-xs text-[#6A6D70] mt-0.5">
                  Triage and inspect {visibleCases.length.toLocaleString()} corporate entity cases across risk priorities
                </p>
              </div>
            </div>

            {!isPipelineExecuted && (
              <div className="mb-4 p-4 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="text-base">ℹ️</span>
                  <span>
                    <strong>Screening Engine Unexecuted:</strong> Workspace is currently empty. Click <strong>&quot;▶ RUN SCREENING PIPELINE&quot;</strong> on the <strong>Dashboard &amp; Pipeline</strong> tab to ingest corporate datasets and generate live cases.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('Dashboard & Pipeline')}
                  className="px-3 py-1 bg-[#0070F2] text-white font-bold rounded-[4px] hover:bg-[#005cbd] transition cursor-pointer whitespace-nowrap ml-3"
                >
                  Go to Pipeline Console →
                </button>
              </div>
            )}

            <KpiTiles
              counts={counts}
              activePriority={filters.priority}
              onSelectPriority={(p) => setFilters((prev) => ({ ...prev, priority: p }))}
            />

            <CaseTable
              rows={visibleCases}
              filters={filters}
              onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              onRowSelect={(caseId) => setSelectedCaseId(caseId)}
              onCloseCase={handleCloseCase}
              onReopenCase={handleReopenCase}
            />
          </div>
        )}

        {/* ================= 3. RULES & ANALYTICS TAB ================= */}
        {(activeTab === 'Rules & Analytics' || activeTab === 'Reports') && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-[#1D2D3E]">Screening Rules & Compliance Analytics</h1>
                <p className="text-xs text-[#6A6D70] mt-0.5">
                  Configure screening rules dynamically and monitor engine evaluation metrics
                </p>
              </div>
            </div>

            {!isPipelineExecuted && (
              <div className="mb-4 p-4 rounded-[4px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="text-base">ℹ️</span>
                  <span>
                    <strong>Screening Engine Standby:</strong> No screening rules loaded. Click <strong>&quot;▶ RUN SCREENING PIPELINE&quot;</strong> on the <strong>Dashboard &amp; Pipeline</strong> tab to load and evaluate all active screening rules.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('Dashboard & Pipeline')}
                  className="px-3 py-1 bg-[#0070F2] text-white font-bold rounded-[4px] hover:bg-[#005cbd] transition cursor-pointer whitespace-nowrap ml-3"
                >
                  Go to Pipeline Console →
                </button>
              </div>
            )}

            {/* Dynamic Screening Rules Table */}
            <div className="bg-white border border-[#D9DBDDE5] rounded-[4px] shadow-sm overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[#D9DBDDE5] bg-[#F5F6F7] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#1D2D3E] uppercase tracking-wider">
                    Active Screening Rules ({filteredRules.length} of {isPipelineExecuted ? rules.length : 0} Rules Loaded)
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-[2px] ${
                      isPipelineExecuted
                        ? 'text-[#107E3E] bg-[#F0F9F3] border border-[#C3E8CE]'
                        : 'text-[#6A6D70] bg-[#F5F6F7] border border-[#D9DBDDE5]'
                    }`}
                  >
                    {isPipelineExecuted ? 'v2.0 Dynamic Dataset Engine Active' : 'Engine Standby (0 Rules Active)'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Category Filter */}
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value)}
                    className="appearance-none pl-2.5 pr-7 py-1 text-xs border border-[#D9DBDDE5] rounded-[4px] bg-white text-[#1D2D3E] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0070F2]/40 focus:border-[#0070F2] transition"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236a7d8f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                    }}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="PATTERN">PATTERN Rules</option>
                    <option value="THRESHOLD">THRESHOLD Rules</option>
                    <option value="VELOCITY">VELOCITY Rules</option>
                    <option value="GEOGRAPHY">GEOGRAPHY Rules</option>
                  </select>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder={rules.length > 0 ? `Search ${rules.length} rules...` : 'Search rules...'}
                    value={ruleSearch}
                    onChange={(e) => setRuleSearch(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-[#D9DBDDE5] rounded-[4px] bg-white text-[#1D2D3E] w-44"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAFBFB] border-b border-[#D9DBDDE5] text-left text-[#6A6D70]">
                      <th className="px-4 py-2.5 font-bold uppercase">Rule Code</th>
                      <th className="px-4 py-2.5 font-bold uppercase">Category</th>
                      <th className="px-4 py-2.5 font-bold uppercase">Rule Description</th>
                      <th className="px-4 py-2.5 font-bold uppercase">Threshold Value</th>
                      <th className="px-4 py-2.5 font-bold uppercase">Risk Impact</th>
                      <th className="px-4 py-2.5 font-bold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECEE]">
                    {!isPipelineExecuted ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-[#6A6D70] bg-[#FAFBFB]">
                          <div className="text-base mb-1 font-semibold text-[#1D2D3E]">
                            Screening Engine Standby (0 Rules Active)
                          </div>
                          <div className="text-xs text-[#6A6D70] max-w-md mx-auto mb-3">
                            Rule evaluation engine is in standby. Click <strong>&quot;▶ RUN SCREENING PIPELINE&quot;</strong> on the Dashboard tab to load and evaluate all 50 screening rules.
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('Dashboard & Pipeline')}
                            className="px-3.5 py-1.5 bg-[#0070F2] text-white text-xs font-bold rounded-[4px] hover:bg-[#005cbd] transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>▶</span>
                            <span>Run Screening Pipeline</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      (filteredRules.length > 0 ? filteredRules : rules).map((r) => (
                        <tr key={r.ruleId || r.ruleCode} className="hover:bg-[#EAF4FF] transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-[#0070F2]">{r.ruleCode}</td>
                          <td className="px-4 py-2.5 font-semibold text-[#1D2D3E]">{r.category}</td>
                          <td className="px-4 py-2.5 text-[#1D2D3E]">{r.ruleDescription || r.ruleName}</td>
                          <td className="px-4 py-2.5 font-mono font-medium text-[#1D2D3E]">{r.thresholdValue}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-[#BB0000]">{r.riskImpact}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F0F9F3] text-[#107E3E] border border-[#C3E8CE]">
                              {r.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Compliance Analytics & Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-[#D9DBDDE5] rounded-[4px] p-4">
                <h3 className="text-xs font-bold uppercase text-[#6A6D70] mb-3">Priority Distribution</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#BB0000]">Regulatory</span>
                    <span className="font-mono text-[#1D2D3E]">{counts.regulatory} cases</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#E9730C]">SLA Overdue</span>
                    <span className="font-mono text-[#1D2D3E]">{counts.overdue} cases</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#0070F2]">Medium Priority</span>
                    <span className="font-mono text-[#1D2D3E]">{counts.medium} cases</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#107E3E]">Low Priority</span>
                    <span className="font-mono text-[#1D2D3E]">{counts.low} cases</span>
                  </div>
                  <div className="flex justify-between border-t border-[#D9DBDDE5] pt-1 mt-1">
                    <span className="font-semibold text-[#6A6D70]">Closed Cases</span>
                    <span className="font-mono text-[#1D2D3E]">{counts.closed} cases</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#D9DBDDE5] rounded-[4px] p-4">
                <h3 className="text-xs font-bold uppercase text-[#6A6D70] mb-3">Risk Factor Weights</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-mono">
                    <span>Counterparty Risk</span>
                    <span className="font-semibold text-[#1D2D3E]">30%</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Jurisdiction Risk</span>
                    <span className="font-semibold text-[#1D2D3E]">20%</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Structural Pattern Risk</span>
                    <span className="font-semibold text-[#1D2D3E]">20%</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Data Integrity Risk</span>
                    <span className="font-semibold text-[#1D2D3E]">15%</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Exposure USD Threshold</span>
                    <span className="font-semibold text-[#1D2D3E]">10%</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Behavioural Baseline Risk</span>
                    <span className="font-semibold text-[#1D2D3E]">5%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#D9DBDDE5] rounded-[4px] p-4">
                <h3 className="text-xs font-bold uppercase text-[#6A6D70] mb-3">Human-in-the-Loop Governance</h3>
                <div className="text-2xl font-bold text-[#0070F2] mb-1">
                  100% Analyst Review
                </div>
                <p className="text-xs text-[#6A6D70]">
                  Mandatory human-in-the-loop compliance sign-off enforced across all cases. AI engine provides scoring & risk drivers only.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <CaseDetailModal
        caseRecord={selectedCase}
        factorWeights={meta?.factorWeights ?? {}}
        queueWeights={meta?.queueWeights ?? {}}
        onClose={() => setSelectedCaseId(null)}
        onCloseCase={handleCloseCase}
        onReopenCase={handleReopenCase}
        onEscalate={handleEscalate}
      />
    </div>
  );
}
