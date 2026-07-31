'use client';

import { useEffect, useMemo, useState } from 'react';
import ShellBar from './components/ShellBar';
import KpiTiles from './components/KpiTiles';
import CaseTable, { type CaseFilters } from './components/CaseTable';
import CaseDetailModal from './components/CaseDetailModal';
import type { CaseRecord, CasesArtifactMeta, Priority } from './lib/cases';

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

export default function Home() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [meta, setMeta] = useState<CasesArtifactMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutations, setMutations] = useState<Mutations>({});
  const [filters, setFilters] = useState<CaseFilters>({ priority: 'all', status: 'all', search: '' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    setMutations(loadMutations());
    (async () => {
      try {
        const res = await fetch('/api/cases');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (!data.cases) throw new Error('No cases in response');
        setCases(data.cases);
        setMeta(data.meta);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load cases');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mergedCases = useMemo(
    () => cases.map((c) => (mutations[c.caseId] ? { ...c, ...mutations[c.caseId] } : c)),
    [cases, mutations]
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

  const handleEscalate = (caseId: string, target: Priority) => {
    applyMutation(caseId, { priority: target });
  };

  const counts = useMemo(() => {
    const c = { ...EMPTY_COUNTS };
    mergedCases.forEach((r) => c[r.priority]++);
    return c;
  }, [mergedCases]);

  const selectedCase = mergedCases.find((c) => c.caseId === selectedCaseId) ?? null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ShellBar />
        <div className="flex-1 flex items-center justify-center text-[#6a7d8f] text-sm">Loading cases…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <ShellBar />
        <div className="flex-1 flex items-center justify-center text-red-600 text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc]">
      <ShellBar />
      <div className="page-content">
        <h1 className="text-xl font-semibold text-[#1d2d3e] mb-4">Case Management</h1>

        <KpiTiles
          counts={counts}
          active={filters.priority === 'all' ? null : filters.priority}
          onToggle={(p) => setFilters((prev) => ({ ...prev, priority: prev.priority === p ? 'all' : p }))}
        />

        <CaseTable
          rows={mergedCases}
          filters={filters}
          onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onRowSelect={setSelectedCaseId}
        />
      </div>

      <CaseDetailModal
        caseRecord={selectedCase}
        factorWeights={meta?.factorWeights ?? {}}
        queueWeights={meta?.queueWeights ?? {}}
        onClose={() => setSelectedCaseId(null)}
        onCloseCase={handleCloseCase}
        onEscalate={handleEscalate}
      />
    </div>
  );
}
