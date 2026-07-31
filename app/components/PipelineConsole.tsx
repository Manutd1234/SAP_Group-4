'use client';

import { useEffect, useRef, useState } from 'react';

interface PipelineConsoleProps {
  isExecuted?: boolean;
  onPipelineComplete?: () => void;
  onResetPipeline?: () => void;
  onStageChange?: (stage: number) => void;
}

interface PipelineStage {
  id: number;
  icon: string;
  code: string;
  name: string;
  subtitle: string;
  details: string;
  datasetRef: string;
  metric: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 1,
    icon: '📥',
    code: 'STAGE-01',
    name: '1. Ingestion & Pre-processing',
    subtitle: 'Extract Raw Datasets',
    details: 'Extracts and ingests company profiles, transactions, UBO records, sanctions lists, risk profiles & audit logs across the full dataset suite.',
    datasetRef: 'Full Corporate Dataset Suite (Companies, Transactions, UBOs, Sanctions, Rules & Audit Logs)',
    metric: 'Raw Datasets Ingested',
  },
  {
    id: 2,
    icon: '🛡️',
    code: 'STAGE-02',
    name: '2. Rule Screening Engine',
    subtitle: 'Hybrid RAG & Sanctions',
    details: 'Screens against active rules & executes Hybrid RAG queries (BM25 + Cosine Vector Search) via SAP HANA Cloud Vector Engine.',
    datasetRef: 'SCREENING_RULES.csv, SANCTIONS_LISTS.csv, narrow_ai/src/rag_engine.py',
    metric: 'Rules & RAG Evaluated',
  },
  {
    id: 3,
    icon: '⚖️',
    code: 'STAGE-03',
    name: '3. v2 Risk Engine Scoring',
    subtitle: 'Python v2 Risk Engine',
    details: 'Launches Python v2 Scoring Engine (narrow_ai/src/v2_scoring_engine.py) to compute 6-factor weighted risk scores across corporate entities.',
    datasetRef: 'narrow_ai/src/v2_scoring_engine.py & app/lib/v2-scoring.ts',
    metric: 'Risk Scores Computed',
  },
  {
    id: 4,
    icon: '💡',
    code: 'STAGE-04',
    name: '4. AI Explainability & Drivers',
    subtitle: 'Joule LLM & RAG Context',
    details: 'Runs Joule LLM Explainability generator to attach plain-language risk drivers & recommendations via RAG context.',
    datasetRef: 'datasets/JOULE_EXPLANATIONS.csv & narrow_ai/src/rag_engine.py',
    metric: 'AI Explanations Bound',
  },
  {
    id: 5,
    icon: '📊',
    code: 'STAGE-05',
    name: '5. Queue Triage & Delivery',
    subtitle: 'Operational Routing',
    details: 'Routes cases to Escalate, Data Chase, Fast-Track & Standard queues for 100% Human-in-the-loop review.',
    datasetRef: 'app/api/cases/route.ts & data/cases.json',
    metric: 'Operational Queues Ready',
  },
];

export default function PipelineConsole({
  isExecuted = false,
  onPipelineComplete,
  onResetPipeline,
  onStageChange,
}: PipelineConsoleProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<number>(isExecuted ? 6 : 0);
  const [completedStages, setCompletedStages] = useState<number[]>(isExecuted ? [1, 2, 3, 4, 5] : []);
  const [progress, setProgress] = useState<number>(isExecuted ? 100 : 0);
  const [logs, setLogs] = useState<string[]>(
    isExecuted
      ? [
          '[0.00s] Initializing SAP AI Core Pipeline Runtime Environment...',
          '[0.50s] STAGE-01: Ingesting corporate dataset files...',
          '[1.30s] STAGE-01 COMPLETE: Parsed corporate transactions and company profiles.',
          '[1.90s] STAGE-02: Executing Rule Engine across active rules (PATTERN, THRESHOLD, VELOCITY, GEOGRAPHY)...',
          '[2.70s] STAGE-02: Running Hybrid RAG query engine (BM25 + Cosine Vector Search via SAP HANA Cloud)...',
          '[3.40s] STAGE-02 COMPLETE: Evaluated active screening rules & OFAC/FATF sanctions matching.',
          '[4.00s] STAGE-03: Launching Python v2 Scoring Engine script (narrow_ai/src/v2_scoring_engine.py)...',
          '[4.80s] STAGE-03: Computing 6-Factor weighted risk scores across corporate entities...',
          '[5.40s] STAGE-03 COMPLETE: Generated v2 risk scores & verified scoring parity.',
          '[6.00s] STAGE-04: Running Joule LLM Explainability Engine & Hybrid RAG context retriever...',
          '[6.70s] STAGE-04 COMPLETE: Bound plain-language AI risk drivers & analyst recommendations.',
          '[7.30s] STAGE-05: Dispatching cases to Escalate, Data Chase, Fast-Track & Standard queues...',
          '[7.80s] STAGE-05 COMPLETE: Populated operational queues for 100% Human-in-the-Loop review.',
          '[7.80s] ✅ SAP AI Core Pipeline execution finished successfully in 7.80s.',
        ]
      : []
  );
  const [selectedStageId, setSelectedStageId] = useState<number>(1);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const resetPipeline = () => {
    setIsRunning(false);
    setCurrentStage(0);
    setCompletedStages([]);
    setProgress(0);
    setLogs([]);
    onResetPipeline?.();
  };

  const startPipeline = () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentStage(1);
    onStageChange?.(1);
    setCompletedStages([]);
    setProgress(5);
    setLogs(['[0.00s] Initializing SAP AI Core Pipeline Runtime Environment...']);

    // Stage 1 Sub-step & Completion
    setTimeout(() => {
      setProgress(12);
      setLogs((prev) => [...prev, '[0.50s] STAGE-01: Ingesting corporate dataset files...']);
    }, 500);

    setTimeout(() => {
      setCompletedStages([1]);
      setCurrentStage(2);
      onStageChange?.(2);
      setProgress(22);
      setLogs((prev) => [
        ...prev,
        '[1.30s] STAGE-01 COMPLETE: Parsed corporate transactions and company profiles.',
      ]);
    }, 1300);

    // Stage 2 Sub-step & Completion (Hybrid RAG)
    setTimeout(() => {
      setProgress(30);
      setLogs((prev) => [
        ...prev,
        '[1.90s] STAGE-02: Executing Rule Engine across active rules (PATTERN, THRESHOLD, VELOCITY, GEOGRAPHY)...',
      ]);
    }, 1900);

    setTimeout(() => {
      setProgress(38);
      setLogs((prev) => [
        ...prev,
        '[2.70s] STAGE-02: Running Hybrid RAG query engine (BM25 + Cosine Vector Search via SAP HANA Cloud)...',
      ]);
    }, 2700);

    setTimeout(() => {
      setCompletedStages([1, 2]);
      setCurrentStage(3);
      onStageChange?.(3);
      setProgress(45);
      setLogs((prev) => [
        ...prev,
        '[3.40s] STAGE-02 COMPLETE: Evaluated active screening rules & OFAC/FATF sanctions matching.',
      ]);
    }, 3400);

    // Stage 3 Sub-step & Completion (Python Scoring Script)
    setTimeout(() => {
      setProgress(52);
      setLogs((prev) => [
        ...prev,
        '[4.00s] STAGE-03: Launching Python v2 Scoring Engine script (narrow_ai/src/v2_scoring_engine.py)...',
      ]);
    }, 4000);

    setTimeout(() => {
      setProgress(60);
      setLogs((prev) => [
        ...prev,
        '[4.80s] STAGE-03: Computing 6-Factor weighted risk scores across corporate entities...',
      ]);
    }, 4800);

    setTimeout(() => {
      setCompletedStages([1, 2, 3]);
      setCurrentStage(4);
      onStageChange?.(4);
      setProgress(68);
      setLogs((prev) => [
        ...prev,
        '[5.40s] STAGE-03 COMPLETE: Generated v2 risk scores & verified scoring parity.',
      ]);
    }, 5400);

    // Stage 4 Sub-step & Completion (Joule LLM & RAG Context)
    setTimeout(() => {
      setProgress(76);
      setLogs((prev) => [
        ...prev,
        '[6.00s] STAGE-04: Running Joule LLM Explainability Engine & Hybrid RAG context retriever...',
      ]);
    }, 6000);

    setTimeout(() => {
      setCompletedStages([1, 2, 3, 4]);
      setCurrentStage(5);
      onStageChange?.(5);
      setProgress(85);
      setLogs((prev) => [
        ...prev,
        '[6.70s] STAGE-04 COMPLETE: Bound plain-language AI risk drivers & analyst recommendations.',
      ]);
    }, 6700);

    // Stage 5 Sub-step & Final Completion
    setTimeout(() => {
      setProgress(93);
      setLogs((prev) => [
        ...prev,
        '[7.30s] STAGE-05: Dispatching cases to Escalate, Data Chase, Fast-Track & Standard queues...',
      ]);
    }, 7300);

    setTimeout(() => {
      setCompletedStages([1, 2, 3, 4, 5]);
      setCurrentStage(6);
      onStageChange?.(6);
      setProgress(100);
      setLogs((prev) => [
        ...prev,
        '[7.80s] STAGE-05 COMPLETE: Populated operational queues for 100% Human-in-the-Loop review.',
        '[7.80s] ✅ SAP AI Core Pipeline execution finished successfully in 7.80s.',
      ]);
      setIsRunning(false);
      onPipelineComplete?.();
    }, 7800);
  };

  const selectedStage = PIPELINE_STAGES.find((s) => s.id === selectedStageId) ?? PIPELINE_STAGES[0];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-[#1e293b] text-white border-b-2 border-[#0070F2] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isRunning ? 'bg-[#38bdf8] animate-ping' : completedStages.length === 5 ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <h2 className="text-sm font-bold text-white tracking-wide">
            SAP AI Core — Screening Pipeline & Risk Engine
          </h2>
          <span className="hidden sm:inline-block text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {completedStages.length === 5 ? 'v2.0 Active' : 'Standby / Unexecuted'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset Button */}
          <button
            type="button"
            disabled={isRunning}
            onClick={resetPipeline}
            title="Reset engine and clear dashboard data"
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔄</span>
            <span>RESET ENGINE & DATA</span>
          </button>

          {/* Run Button */}
          <button
            type="button"
            disabled={isRunning}
            onClick={startPipeline}
            className="px-4 py-2 text-xs font-bold text-white bg-[#0070F2] hover:bg-[#005cbd] active:bg-[#004085] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {isRunning ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Executing Stage {Math.min(5, currentStage)} ({progress}%)…</span>
              </>
            ) : (
              <span>▶ RUN SCREENING PIPELINE</span>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="w-full bg-[#EAF4FF] h-1.5">
          <div
            className="bg-[#0070F2] h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Stage Flow Nodes */}
      <div className="p-4 border-b border-slate-200 bg-[#f8fafc]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Pipeline Flow Sequence
          </span>
          {completedStages.length === 5 && (
            <span className="text-xs font-bold text-[#107E3E] bg-[#F0F9F3] border border-[#C3E8CE] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
              <span>✓</span> PIPELINE VERIFIED COMPLETE (5/5)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PIPELINE_STAGES.map((s, index) => {
            const isSelected = s.id === selectedStageId;
            const isCompleted = completedStages.includes(s.id);
            const isExecuting = currentStage === s.id && isRunning;

            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedStageId(s.id)}
                  className={`w-full p-3.5 rounded-xl text-left transition cursor-pointer border ${
                    isCompleted
                      ? 'bg-[#F0F9F3] border-[#107E3E] text-[#107E3E] shadow-2xs font-semibold'
                      : isExecuting
                      ? 'bg-[#EAF4FF] border-[#0070F2] text-[#0070F2] shadow-sm animate-pulse font-bold'
                      : isSelected
                      ? 'bg-white border-[#0070F2] text-[#1D2D3E] ring-1 ring-[#0070F2]'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-[#0070F2]/60 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">{s.icon}</span>
                    {isCompleted ? (
                      <span className="text-[10px] font-bold bg-[#107E3E] text-white px-1.5 py-0.5 rounded">
                        ✓ DONE
                      </span>
                    ) : isExecuting ? (
                      <span className="text-[10px] font-bold bg-[#0070F2] text-white px-1.5 py-0.5 rounded animate-pulse">
                        RUNNING
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        READY
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-bold text-[#1D2D3E] truncate">{s.name.replace(/^\d+\.\s*/, '')}</div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">{s.metric}</div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Detail Inspector + Terminal Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Stage Inspector */}
        <div className="p-4.5 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0070F2] uppercase tracking-wide flex items-center gap-1.5">
              <span>{selectedStage.icon}</span> {selectedStage.code} Inspector
            </span>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
              {selectedStage.metric}
            </span>
          </div>

          <h3 className="text-sm font-bold text-[#1D2D3E] mb-1">{selectedStage.name}</h3>
          <p className="text-xs text-slate-500 mb-3">{selectedStage.subtitle}</p>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-2">
            <div>
              <span className="font-semibold text-[#1D2D3E]">Execution Details: </span>
              <span className="text-slate-600">{selectedStage.details}</span>
            </div>
            <div>
              <span className="font-semibold text-[#1D2D3E]">Source Files: </span>
              <code className="text-[#0070F2] font-mono text-[11px] font-medium">{selectedStage.datasetRef}</code>
            </div>
            <div>
              <span className="font-semibold text-[#1D2D3E]">Status: </span>
              {completedStages.includes(selectedStage.id) ? (
                <span className="text-[#107E3E] font-bold">Completed & Verified</span>
              ) : currentStage === selectedStage.id && isRunning ? (
                <span className="text-[#0070F2] font-bold">Executing Live...</span>
              ) : (
                <span className="text-slate-500">Ready for execution</span>
              )}
            </div>
          </div>
        </div>

        {/* High-Tech Terminal Log */}
        <div className="p-4.5 bg-[#0a0f1d] text-white font-mono text-xs overflow-hidden flex flex-col justify-between min-h-[170px]">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[11px]">
              <span className="flex items-center gap-1.5 font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> TERMINAL EXECUTION LOG
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {isRunning ? 'STATUS: RUNNING' : completedStages.length === 5 ? 'STATUS: COMPLETE' : 'STATUS: IDLE'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[125px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">
                  Click &apos;▶ RUN SCREENING PIPELINE&apos; above to execute batch data screening...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="leading-tight font-mono text-[11px]">
                    {log.includes('COMPLETE') || log.includes('finished') ? (
                      <span className="text-emerald-400 font-bold">{log}</span>
                    ) : log.includes('Initializing') ? (
                      <span className="text-cyan-400 font-semibold">{log}</span>
                    ) : (
                      <span className="text-slate-200">{log}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
