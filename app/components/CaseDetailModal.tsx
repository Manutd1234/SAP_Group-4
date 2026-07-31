'use client';

import { useEffect, useRef, useState } from 'react';
import type { CaseRecord, Priority } from '@/app/lib/cases';
import { PRIORITY_LABELS, PRIORITY_ORDER, formatUsd } from '@/app/lib/cases';

interface CaseDetailModalProps {
  caseRecord: CaseRecord | null;
  factorWeights: Record<string, number>;
  queueWeights: Record<string, number>;
  onClose: () => void;
  onCloseCase: (caseId: string) => void;
  onReopenCase: (caseId: string) => void;
  onEscalate: (caseId: string, target: Priority) => void;
}

const FACTOR_LABELS: Record<string, string> = {
  COUNTERPARTY: 'Counterparty',
  JURISDICTION: 'Jurisdiction',
  STRUCTURAL: 'Structural',
  EXPOSURE: 'Exposure',
  BEHAVIOURAL: 'Behavioural',
  DATA_INTEGRITY: 'Data Integrity',
};

const QUEUE_TERM_LABELS: Record<string, string> = {
  slaUrgency: 'SLA urgency',
  riskScore: 'Risk score',
  regExposure: 'Reg exposure',
  alertAge: 'Alert age',
};

export default function CaseDetailModal({
  caseRecord,
  factorWeights,
  queueWeights,
  onClose,
  onCloseCase,
  onReopenCase,
  onEscalate,
}: CaseDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [escalateTarget, setEscalateTarget] = useState<Priority | ''>('');

  useEffect(() => {
    setEscalateTarget('');
  }, [caseRecord?.caseId]);

  useEffect(() => {
    if (!caseRecord) return;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [caseRecord, onClose]);

  if (!caseRecord) return null;
  const c = caseRecord;
  const isClosed = c.status === 'CLOSED' || c.priority === 'closed';

  const escalateOptions = (Object.keys(PRIORITY_ORDER) as Priority[]).filter(
    (p) => p !== 'closed' && PRIORITY_ORDER[p] < PRIORITY_ORDER[c.priority]
  );
  const canEscalate = escalateOptions.length > 0 && !isClosed;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="case-modal-title" tabIndex={-1}>
        <div className="modal-header">
          <div>
            <h2 id="case-modal-title">{c.legalName}</h2>
            <small>
              {c.caseNumber} · {c.caseId}
            </small>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <section className="mb-6">
            <h3 className="kicker">Case Summary</h3>
            <p className="text-sm text-[#1d2d3e] leading-relaxed mb-4">
              {c.narrative.alertSummary ?? 'No Joule summary available for this case.'}
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[#6a7d8f] uppercase tracking-wide mb-0.5">Assigned To</div>
                <div className="text-[#1d2d3e] font-medium">{c.assignedAnalyst ?? '—'}</div>
              </div>
              <div>
                <div className="text-[#6a7d8f] uppercase tracking-wide mb-0.5">Case Type</div>
                <div className="text-[#1d2d3e] font-medium">{c.caseType ?? '—'}</div>
              </div>
              <div>
                <div className="text-[#6a7d8f] uppercase tracking-wide mb-0.5">Amount</div>
                <div className="text-[#1d2d3e] font-medium">{formatUsd(c.amountUsd)}</div>
              </div>
              <div>
                <div className="text-[#6a7d8f] uppercase tracking-wide mb-0.5">Last Updated</div>
                <div className="text-[#1d2d3e] font-medium">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <div className="text-[#6a7d8f] uppercase tracking-wide mb-0.5">Resolution Target</div>
                <div className="text-[#1d2d3e] font-medium">{new Date(c.dueDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-[#6a7d8f] uppercase tracking-wide mb-0.5">Reviewing Manager</div>
                <div className="text-[#1d2d3e] font-medium">{c.reviewingManager ?? '—'}</div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="kicker mb-0">Why This Score</h3>
              <span className="text-xs font-semibold text-[#1d2d3e]">
                risk {c.riskScore} / 100 · {c.riskTier}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {Object.entries(factorWeights)
                .filter(([, max]) => max > 0)
                .map(([factor, max]) => {
                  const earned = c.factorScores[factor as keyof typeof c.factorScores] ?? 0;
                  const pct = max > 0 ? Math.min(100, (earned / max) * 100) : 0;
                  return (
                    <div key={factor} className="flex items-center gap-3 text-xs">
                      <span className="w-28 shrink-0 text-[#6a7d8f]">{FACTOR_LABELS[factor] ?? factor}</span>
                      <div className="flex-1 h-2 bg-[#eaecee] rounded-full overflow-hidden">
                        <div className="h-full bg-[#0070f2] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right tabular-nums text-[#1d2d3e]">
                        {earned} / {max}
                      </span>
                    </div>
                  );
                })}
            </div>
            {c.reasonCodes.length > 0 && (
              <p className="text-xs text-[#6a7d8f] mt-3">Reason codes: {c.reasonCodes.map((rc) => rc.code).join(', ')}</p>
            )}
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="kicker mb-0">Why This Rank</h3>
              <span className="text-xs font-semibold text-[#1d2d3e]">queue {c.queueScore} / 100</span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {Object.entries(queueWeights).map(([term, weight]) => {
                const value = c.queueTerms[term as keyof typeof c.queueTerms] ?? 0;
                const contribution = Math.round(value * weight * 100) / 100;
                return (
                  <div key={term} className="flex items-center justify-between text-[#1d2d3e]">
                    <span className="text-[#6a7d8f]">{QUEUE_TERM_LABELS[term] ?? term}</span>
                    <span className="tabular-nums">
                      {value} × {weight} = {contribution.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex items-center justify-between text-xs pt-3 border-t border-[#eaecee]">
            <div className="flex items-center gap-2">
              <span className="text-[#6a7d8f]">Evidence confidence</span>
              <span className="font-semibold text-[#1d2d3e] tabular-nums">{c.evidenceConfidence}</span>
            </div>
            <span className="badge badge-info">Queue: {c.assignedQueue}</span>
          </section>
        </div>

        <div className="modal-footer items-center">
          {canEscalate && (
            <select
              value={escalateTarget}
              onChange={(e) => setEscalateTarget(e.target.value as Priority)}
              className="text-xs border border-[#d9dbdd] rounded px-2 py-1.5 mr-auto"
              aria-label="Escalate to priority"
            >
              <option value="">Escalate to…</option>
              {escalateOptions.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => onCloseCase(c.caseId)}
            disabled={c.status === 'CLOSED'}
          >
            Close Case
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canEscalate || !escalateTarget}
            onClick={() => escalateTarget && onEscalate(c.caseId, escalateTarget)}
          >
            Escalate
          </button>
        </div>
      </div>
    </div>
  );
}
