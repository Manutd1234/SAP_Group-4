export type Priority = 'low' | 'medium' | 'overdue' | 'regulatory' | 'closed';
export type RiskTier = 'HIGH' | 'MEDIUM' | 'LOW';
export type AssignedQueue = 'AUTO_CLEAR' | 'DATA_CHASE' | 'ESCALATE' | 'STANDARD';
export type CaseStatus = 'OPEN' | 'CLOSED';
export type DisplayStatus = 'Open' | 'Escalated' | 'Overdue' | 'Auto-Clear' | 'Data Chase' | 'Closed';

export interface ReasonCode {
  code: string;
  factor: string;
  points: number;
  description: string;
}

export interface FactorScores {
  COUNTERPARTY: number;
  JURISDICTION: number;
  STRUCTURAL: number;
  EXPOSURE: number;
  BEHAVIOURAL: number;
  DATA_INTEGRITY: number;
}

export interface QueueTerms {
  slaUrgency: number;
  riskScore: number;
  regExposure: number;
  alertAge: number;
}

export interface CaseNarrative {
  alertSummary: string | null;
  riskDriver: string | null;
  recommendation: string | null;
}

export interface CaseRecord {
  caseId: string;
  caseNumber: string;
  caseTitle: string | null;
  companyId: string;
  legalName: string;
  caseType: string | null;
  status: CaseStatus;
  outcome: string | null;
  assignedAnalyst: string | null;
  reviewingManager: string | null;
  openedAt: string;
  dueDate: string;
  updatedAt: string | null;
  closedAt: string | null;
  daysElapsed: number;
  amountUsd: number;
  hasLinkedAlert: boolean;
  alertId: string | null;
  transactionId: string | null;
  riskScore: number;
  riskTier: RiskTier;
  evidenceConfidence: number;
  autoClearEligible: boolean;
  assignedQueue: AssignedQueue;
  queueScore: number;
  reasonCodes: ReasonCode[];
  factorScores: FactorScores;
  queueTerms: QueueTerms;
  priority: Priority;
  narrative: CaseNarrative;
}

export interface CasesArtifactMeta {
  weightVersion: string;
  factorWeights: Record<string, number>;
  queueWeights: Record<string, number>;
  asOf: string;
  generatedAt: string;
  totalCases: number;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low Priority',
  medium: 'Medium Priority',
  overdue: 'High Priority (Overdue)',
  regulatory: 'High Priority (Regulatory)',
  closed: 'Closed',
};

export const PRIORITY_STYLES: Record<Priority, { dot: string; badge: string; text: string }> = {
  low: { dot: 'bg-[#188918]', badge: 'bg-[#f0faf0] text-[#188918] border-[#b8e0b8]', text: 'text-[#188918]' },
  medium: { dot: 'bg-[#e76500]', badge: 'bg-[#fff4e0] text-[#e76500] border-[#f5c87a]', text: 'text-[#e76500]' },
  overdue: { dot: 'bg-[#aa0808]', badge: 'bg-[#ffeaea] text-[#aa0808] border-[#f5b8b8]', text: 'text-[#aa0808]' },
  regulatory: { dot: 'bg-[#6912d6]', badge: 'bg-[#f5edff] text-[#6912d6] border-[#d4b3f5]', text: 'text-[#6912d6]' },
  closed: { dot: 'bg-[#8c9cb0]', badge: 'bg-[#f0f2f5] text-[#8c9cb0] border-[#c8d0d8]', text: 'text-[#8c9cb0]' },
};

// Lower number = higher severity/rank.
export const PRIORITY_ORDER: Record<Priority, number> = { regulatory: 0, overdue: 1, medium: 2, low: 3, closed: 4 };

export const STATUS_STYLES: Record<DisplayStatus, string> = {
  Open: 'bg-[#eaf4ff] text-[#0070f2] border-[#b3d4f5]',
  Escalated: 'bg-[#ffeaea] text-[#aa0808] border-[#f5b8b8]',
  Overdue: 'bg-[#ffeaea] text-[#aa0808] border-[#f5b8b8]',
  'Auto-Clear': 'bg-[#f0faf0] text-[#188918] border-[#b8e0b8]',
  'Data Chase': 'bg-[#fff4e0] text-[#e76500] border-[#f5c87a]',
  Closed: 'bg-[#f0f2f5] text-[#8c9cb0] border-[#c8d0d8]',
};

// Precedence: closed > escalated (regulatory/risk-driven, from Ian's queue routing) >
// overdue (SLA-breach ground truth) > auto-clear / data-chase > open. A case that is both
// ESCALATE-queued and SLA-breached shows as Escalated — regulatory concerns take priority.
export function displayStatus(c: Pick<CaseRecord, 'status' | 'assignedQueue' | 'priority'>): DisplayStatus {
  if (c.status === 'CLOSED') return 'Closed';
  if (c.assignedQueue === 'ESCALATE') return 'Escalated';
  if (c.priority === 'overdue') return 'Overdue';
  switch (c.assignedQueue) {
    case 'AUTO_CLEAR':
      return 'Auto-Clear';
    case 'DATA_CHASE':
      return 'Data Chase';
    default:
      return 'Open';
  }
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
