"use client";

import { useMemo, useState } from "react";
import CaseTable from "./components/CaseTable";

type View = "overview" | "cases" | "workflow" | "architecture";
type CaseStatus = "New" | "Investigating" | "Awaiting approval";

type RiskCase = {
  id: string;
  customer: string;
  initials: string;
  amount: string;
  route: string;
  time: string;
  score: number;
  status: CaseStatus;
  pattern: string;
  factors: Array<{
    label: string;
    detail: string;
    points: number;
    tone: "critical" | "warning" | "neutral";
  }>;
};

const cases: RiskCase[] = [
  {
    id: "RC-2048",
    customer: "Orion Exports Pte Ltd",
    initials: "OE",
    amount: "USD 247,500",
    route: "Singapore → UAE → Latvia",
    time: "8 min ago",
    score: 87,
    status: "New",
    pattern: "Rapid multi-hop transfer",
    factors: [
      {
        label: "Velocity anomaly",
        detail: "4 transfers within 31 minutes; 6.2× customer baseline",
        points: 28,
        tone: "critical",
      },
      {
        label: "High-risk routing",
        detail: "Intermediary jurisdiction differs from normal trade corridor",
        points: 22,
        tone: "critical",
      },
      {
        label: "Beneficiary data gap",
        detail: "Ultimate beneficiary identifier is missing",
        points: 20,
        tone: "warning",
      },
      {
        label: "Amount deviation",
        detail: "Transaction is 3.7× the customer’s 90-day median",
        points: 17,
        tone: "warning",
      },
    ],
  },
  {
    id: "RC-2047",
    customer: "Atlas Meridian LLC",
    initials: "AM",
    amount: "USD 92,400",
    route: "New York → Panama",
    time: "21 min ago",
    score: 74,
    status: "Investigating",
    pattern: "Structuring indicators",
    factors: [
      {
        label: "Repeated round amounts",
        detail: "Three payments just below the review threshold",
        points: 26,
        tone: "critical",
      },
      {
        label: "Counterparty novelty",
        detail: "First transaction with this beneficiary",
        points: 18,
        tone: "warning",
      },
      {
        label: "Narrative ambiguity",
        detail: "Payment purpose does not match invoice category",
        points: 17,
        tone: "warning",
      },
      {
        label: "Customer baseline",
        detail: "Other account behaviour remains consistent",
        points: 13,
        tone: "neutral",
      },
    ],
  },
  {
    id: "RC-2046",
    customer: "Northstar Digital GmbH",
    initials: "ND",
    amount: "EUR 61,250",
    route: "Berlin → Singapore",
    time: "47 min ago",
    score: 63,
    status: "Awaiting approval",
    pattern: "Profile mismatch",
    factors: [
      {
        label: "Profile mismatch",
        detail: "Transfer category differs from declared business activity",
        points: 24,
        tone: "critical",
      },
      {
        label: "After-hours activity",
        detail: "Initiated outside the customer’s normal operating window",
        points: 16,
        tone: "warning",
      },
      {
        label: "New device",
        detail: "Unrecognised device passed step-up authentication",
        points: 13,
        tone: "warning",
      },
      {
        label: "Known beneficiary",
        detail: "Beneficiary was previously verified",
        points: 10,
        tone: "neutral",
      },
    ],
  },
  {
    id: "RC-2045",
    customer: "Kestrel Marine SA",
    initials: "KM",
    amount: "USD 34,800",
    route: "Geneva → Rotterdam",
    time: "1 hr ago",
    score: 46,
    status: "Investigating",
    pattern: "Documentation gap",
    factors: [
      {
        label: "Invoice mismatch",
        detail: "Cargo description requires officer confirmation",
        points: 18,
        tone: "warning",
      },
      {
        label: "Document quality",
        detail: "One supporting document has low OCR confidence",
        points: 12,
        tone: "warning",
      },
      {
        label: "Expected corridor",
        detail: "Route matches prior customer activity",
        points: 8,
        tone: "neutral",
      },
      {
        label: "Amount baseline",
        detail: "Value is within the normal range",
        points: 8,
        tone: "neutral",
      },
    ],
  },
];

const assistantResponses = {
  explain: {
    eyebrow: "Risk explanation",
    title: "Why is this transaction high risk?",
    body: "The score is driven primarily by unusual transfer velocity and routing. Four linked transfers were initiated within 31 minutes—6.2× Orion Exports’ baseline—and the payment passed through an intermediary outside its normal trade corridor. A missing ultimate-beneficiary identifier adds material uncertainty.",
    callout: "Recommendation: hold for enhanced due diligence. This is decision support, not an automated disposition.",
  },
  summarize: {
    eyebrow: "Case summary",
    title: "Summarise this case",
    body: "Orion Exports initiated a USD 247,500 payment from Singapore through the UAE to Latvia. The amount is 3.7× its 90-day median. The route is new, activity was unusually rapid, and ultimate-beneficiary data is incomplete. No sanctions match was found.",
    callout: "Next best action: request beneficiary ownership evidence and validate the commercial purpose.",
  },
  sar: {
    eyebrow: "Draft generated",
    title: "SAR narrative — officer review required",
    body: "On 30 July 2026, Orion Exports Pte Ltd initiated a USD 247,500 outward transfer involving a previously unseen intermediary route. Review identified four linked transfers within 31 minutes, a material deviation from historical activity, and incomplete ultimate-beneficiary information. The institution placed the transaction on hold pending enhanced due diligence.",
    callout: "Draft only. An authorised officer must verify facts, select the applicable jurisdiction and approve filing.",
  },
};

function scoreBand(score: number) {
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState(cases[0].id);
  const [assistantMode, setAssistantMode] =
    useState<keyof typeof assistantResponses>("explain");
  const [decision, setDecision] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selectedCase = useMemo(
    () => cases.find((riskCase) => riskCase.id === selectedId) ?? cases[0],
    [selectedId],
  );

  function openCase(id: string) {
    setSelectedId(id);
    setDecision(null);
    setView("cases");
  }

  function askAssistant(mode: keyof typeof assistantResponses) {
    setAssistantMode(mode);
    setQuery("");
  }

  const response = assistantResponses[assistantMode];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            R
          </div>
          <div>
            <strong>RiskSignal</strong>
            <span>Financial Crime AI</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <button
            className={view === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setView("overview")}
          >
            <span aria-hidden="true">◫</span> Control center
          </button>
          <button
            className={view === "cases" ? "nav-item active" : "nav-item"}
            onClick={() => setView("cases")}
          >
            <span aria-hidden="true">◎</span> Case queue
            <b>12</b>
          </button>
          <button
            className={view === "workflow" ? "nav-item active" : "nav-item"}
            onClick={() => setView("workflow")}
          >
            <span aria-hidden="true">↝</span> Workflow studio
          </button>
          <button
            className={
              view === "architecture" ? "nav-item active" : "nav-item"
            }
            onClick={() => setView("architecture")}
          >
            <span aria-hidden="true">⌘</span> Architecture
          </button>
          <p className="nav-label">Governance</p>
          <button className="nav-item" onClick={() => setView("architecture")}>
            <span aria-hidden="true">◇</span> Model registry
          </button>
          <button className="nav-item" onClick={() => setView("architecture")}>
            <span aria-hidden="true">✓</span> Audit evidence
          </button>
        </nav>

        <div className="system-card">
          <div className="system-title">
            <span className="status-dot" /> All systems operational
          </div>
          <p>Risk engine v2.4.1</p>
          <p>Last policy sync · 4 min ago</p>
        </div>

        <div className="user-card">
          <div className="avatar">IL</div>
          <div>
            <strong>Investigation Lead</strong>
            <span>Singapore hub</span>
          </div>
          <button aria-label="Open user menu">•••</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="kicker">
              {view === "architecture"
                ? "Solution blueprint"
                : view === "workflow"
                  ? "End-to-end simulation"
                  : "Financial crime operations"}
            </p>
            <h1>
              {view === "overview"
                ? "Risk control center"
                : view === "cases"
                  ? `Case ${selectedCase.id}`
                  : view === "workflow"
                    ? "Integrated workflow studio"
                    : "Architecture & governance"}
            </h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search cases">
              ⌕
            </button>
            <button className="icon-button notification" aria-label="Alerts">
              ♢<span />
            </button>
            <div className="environment">
              <span className="status-dot" /> Demo environment
            </div>
          </div>
        </header>

        {view === "overview" && (
          <Overview selectedCase={selectedCase} onOpenCase={openCase} />
        )}

        {view === "cases" && (
          <div className="max-w-full">
            <div className="mb-4">
              <h1 className="text-xl font-semibold text-[#1d2d3e]">Case Overview</h1>
              <p className="text-xs text-[#6a7d8f] mt-0.5">Monitor and manage all open cases across priority levels · Click a row to view details</p>
            </div>
            <CaseTable />
          </div>
        )}

        {view === "workflow" && <WorkflowStudio />}

        {view === "architecture" && <Architecture />}
      </section>
    </main>
  );
}

function Overview({
  selectedCase,
  onOpenCase,
}: {
  selectedCase: RiskCase;
  onOpenCase: (id: string) => void;
}) {
  return (
    <div className="page-content">
      <section className="hero-strip">
        <div>
          <span className="hero-label">Live risk posture</span>
          <h2>Focus human attention where it matters most.</h2>
          <p>
            Transparent scoring, governed AI assistance and auditable officer
            decisions—connected across the investigation lifecycle.
          </p>
        </div>
        <button className="primary-button" onClick={() => onOpenCase("RC-2048")}>
          Review highest-risk case <span>→</span>
        </button>
      </section>

      <section className="metric-grid" aria-label="Risk operations summary">
        <Metric
          label="Open alerts"
          value="148"
          trend="12 require review"
          tone="red"
        />
        <Metric
          label="High-risk cases"
          value="12"
          trend="3 new this hour"
          tone="orange"
        />
        <Metric
          label="Median review time"
          value="18m"
          trend="↓ 31% vs baseline"
          tone="green"
        />
        <Metric
          label="Precision at review"
          value="82.4%"
          trend="↑ 6.8 pts this month"
          tone="blue"
        />
      </section>

      <div className="overview-grid">
        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <p className="kicker">Prioritised queue</p>
              <h3>Cases requiring attention</h3>
            </div>
            <button className="text-button" onClick={() => onOpenCase("RC-2048")}>
              View all cases →
            </button>
          </div>
          <div className="case-table" role="table" aria-label="Open cases">
            <div className="case-row table-head" role="row">
              <span>Entity / case</span>
              <span>Pattern</span>
              <span>Exposure</span>
              <span>Risk</span>
              <span aria-hidden="true" />
            </div>
            {cases.map((riskCase) => (
              <button
                className="case-row"
                role="row"
                key={riskCase.id}
                onClick={() => onOpenCase(riskCase.id)}
              >
                <span className="entity-cell">
                  <span className="entity-avatar">{riskCase.initials}</span>
                  <span>
                    <strong>{riskCase.customer}</strong>
                    <small>
                      {riskCase.id} · {riskCase.time}
                    </small>
                  </span>
                </span>
                <span className="pattern-cell">
                  {riskCase.pattern}
                  <small>{riskCase.route}</small>
                </span>
                <span className="amount-cell">{riskCase.amount}</span>
                <span className={`risk-chip risk-${scoreBand(riskCase.score)}`}>
                  <b>{riskCase.score}</b> {scoreBand(riskCase.score)}
                </span>
                <span className="row-arrow">›</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel live-panel">
          <div className="panel-heading compact">
            <div>
              <p className="kicker">Risk pulse</p>
              <h3>Signals by category</h3>
            </div>
            <span className="live-label">
              <span className="status-dot" /> Live
            </span>
          </div>
          <div className="signal-list">
            <Signal label="Transaction anomaly" value={38} max={45} color="red" />
            <Signal label="Data quality" value={27} max={45} color="orange" />
            <Signal label="Network exposure" value={19} max={45} color="blue" />
            <Signal label="Sanctions screening" value={7} max={45} color="green" />
          </div>
          <div className="model-note">
            <div className="model-note-icon">AI</div>
            <div>
              <strong>Model health is within tolerance</strong>
              <p>
                Drift 2.1% · false-positive rate 17.6% · validated 28 Jul
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section className="panel journey-panel">
        <div className="panel-heading compact">
          <div>
            <p className="kicker">Governed workflow</p>
            <h3>From signal to accountable decision</h3>
          </div>
          <span className="audit-badge">Every step logged</span>
        </div>
        <div className="journey">
          {[
            ["01", "Detect", "Rules + anomaly models"],
            ["02", "Score", "Weighted, explainable risk"],
            ["03", "Prioritise", "SLA + risk-based queue"],
            ["04", "Investigate", "Joule-guided evidence"],
            ["05", "Decide", "Named officer approval"],
            ["06", "Learn", "Outcome feeds validation"],
          ].map(([number, title, copy], index) => (
            <div className="journey-step" key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <small>{copy}</small>
              {index < 5 && <i aria-hidden="true">→</i>}
            </div>
          ))}
        </div>
      </section>

      <div className="sr-only" aria-live="polite">
        Highest current score is {selectedCase.score}.
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  trend,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`} aria-hidden="true">
        {tone === "red" ? "!" : tone === "orange" ? "◆" : tone === "green" ? "↘" : "◎"}
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span className={`metric-trend ${tone}`}>{trend}</span>
      </div>
    </article>
  );
}

function Signal({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="signal">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="signal-track">
        <span
          className={color}
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

type WorkflowStep = {
  id: string;
  problem: 1 | 2 | 3;
  title: string;
  owner: string;
  system: string;
  action: string;
  output: string;
  control: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    id: "P1.1",
    problem: 1,
    title: "Ingest transaction context",
    owner: "Data pipeline",
    system: "SAP S/4HANA → HANA Cloud",
    action:
      "Join payment, customer, beneficiary, device and 90-day behaviour records.",
    output: "Standardised transaction TX-882190 with source lineage",
    control: "Schema validation, entitlement check and timestamped lineage",
  },
  {
    id: "P1.2",
    problem: 1,
    title: "Assess data quality",
    owner: "Data Quality Agent",
    system: "HANA Cloud",
    action:
      "Classify fields as complete, missing-mandatory, unavailable-optional or ambiguous.",
    output: "Ultimate-beneficiary ID flagged missing-mandatory",
    control:
      "Missing mandatory data adds an approved signal; ambiguity never becomes an adverse fact",
  },
  {
    id: "P1.3",
    problem: 1,
    title: "Detect complex patterns",
    owner: "Screening Agent",
    system: "Rules + narrow AI models",
    action:
      "Run velocity, profile, routing, counterparty-network and document checks.",
    output: "Four traceable signals with model and rule versions",
    control: "No generative model participates in score calculation",
  },
  {
    id: "P1.4",
    problem: 1,
    title: "Calculate explainable risk",
    owner: "Risk engine",
    system: "Weighted scoring service",
    action:
      "Add approved reason-code contributions and cap the composite score at 100.",
    output: "Risk 87 / High with +28, +22, +20 and +17 breakdown",
    control: "Every point links to evidence, policy version and observation time",
  },
  {
    id: "P2.1",
    problem: 2,
    title: "Create and prioritise case",
    owner: "Workflow orchestrator",
    system: "SAP Build Process Automation",
    action:
      "Create a case and rank it using risk, uncertainty, value and remaining SLA.",
    output: "RC-2048 placed first with a 60-minute review SLA",
    control: "Queue policy is versioned and reproducible",
  },
  {
    id: "P2.2",
    problem: 2,
    title: "Assign the right investigator",
    owner: "Case router",
    system: "Build Process Automation / Service Cloud",
    action:
      "Route by jurisdiction, skill, workload, segregation of duties and escalation tier.",
    output: "Assigned to Singapore Investigation Lead",
    control: "Conflicts and workload limits are checked before assignment",
  },
  {
    id: "P2.3",
    problem: 2,
    title: "Investigate with Joule",
    owner: "Investigation Agent",
    system: "Joule Studio",
    action:
      "Explain the score, summarise evidence, identify gaps and suggest the next request.",
    output: "Grounded summary and enhanced-due-diligence checklist",
    control: "Sources are restricted to approved case facts and effective policies",
  },
  {
    id: "P2.4",
    problem: 2,
    title: "Accept, reject or ask",
    owner: "Investigation officer",
    system: "SAP Build dashboard",
    action:
      "Review the suggestion, request more evidence or select the case disposition.",
    output: "Officer escalates to enhanced due diligence",
    control: "Only an authorised human may hold, release, escalate or report",
  },
  {
    id: "P3.1",
    problem: 3,
    title: "Apply jurisdiction policy",
    owner: "Governance Assistant",
    system: "Policy knowledge service",
    action:
      "Resolve jurisdiction, effective date and the approved Singapore or US control pack.",
    output: "Applicable controls and source identifiers attached",
    control: "Regulatory text is effective-dated, approved and checksum-verified",
  },
  {
    id: "P3.2",
    problem: 3,
    title: "Validate AI output",
    owner: "Output Guard",
    system: "Policy rules + optional Llama Guard 3",
    action:
      "Check grounding, prohibited actions, sensitive data and required disclaimers.",
    output: "Response permitted with human-review limitation",
    control: "Content safety supports—but never replaces—business controls",
  },
  {
    id: "P3.3",
    problem: 3,
    title: "Draft report and approve",
    owner: "SAR Drafting skill + officer",
    system: "Joule Studio / Build Process Automation",
    action:
      "Draft from verified facts, then require factual review and named approval.",
    output: "Draft retained; no filing occurs in the demo",
    control: "Dual control and jurisdiction-specific filing authority",
  },
  {
    id: "P3.4",
    problem: 3,
    title: "Audit, monitor and learn",
    owner: "Audit Agent / Model Risk",
    system: "HANA Cloud + SAP Analytics Cloud",
    action:
      "Package evidence and feed the verified outcome into monitoring and validation.",
    output: "Audit bundle, KPI update and champion–challenger feedback",
    control: "Append-only events; outcome labels require quality review",
  },
];

function WorkflowStudio() {
  const [activeStep, setActiveStep] = useState(0);
  const [jurisdiction, setJurisdiction] = useState<"Singapore" | "United States">(
    "Singapore",
  );
  const currentStep = workflowSteps[activeStep];
  const completed = activeStep === workflowSteps.length;
  const progress = Math.round((activeStep / workflowSteps.length) * 100);

  const problemMeta = {
    1: {
      short: "Detection accuracy",
      title: "Problem 1 · Outdated framework",
      description:
        "Move from static thresholds to governed pattern detection and explainable scores.",
      color: "blue",
    },
    2: {
      short: "Operational scale",
      title: "Problem 2 · Operational inefficiency",
      description:
        "Prioritise work, orchestrate evidence and keep investigators in control.",
      color: "teal",
    },
    3: {
      short: "Regulatory assurance",
      title: "Problem 3 · Regulatory intensity",
      description:
        "Apply jurisdiction policy, validate AI and retain regulator-ready evidence.",
      color: "orange",
    },
  } as const;

  function runNext() {
    setActiveStep((step) => Math.min(step + 1, workflowSteps.length));
  }

  return (
    <div className="workflow-studio-page">
      <section className="workflow-command">
        <div>
          <p className="kicker">Scenario TX-882190</p>
          <h2>Run one transaction through all three problem workflows.</h2>
          <p>
            The simulation shows the owner, system action, output and control
            evidence created at every hand-off.
          </p>
        </div>
        <div className="command-controls">
          <label>
            Jurisdiction pack
            <select
              value={jurisdiction}
              onChange={(event) =>
                setJurisdiction(event.target.value as typeof jurisdiction)
              }
            >
              <option>Singapore</option>
              <option>United States</option>
            </select>
          </label>
          <div className="progress-block">
            <span>
              {activeStep} of {workflowSteps.length} controls executed
            </span>
            <strong>{progress}%</strong>
            <div>
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button className="primary-button" onClick={runNext} disabled={completed}>
            {completed ? "Workflow complete" : "Run next control →"}
          </button>
          <button
            className="reset-button"
            onClick={() => setActiveStep(0)}
            disabled={activeStep === 0}
          >
            Reset simulation
          </button>
        </div>
      </section>

      <section className="problem-track-grid">
        {([1, 2, 3] as const).map((problemNumber) => {
          const meta = problemMeta[problemNumber];
          const problemSteps = workflowSteps.filter(
            (step) => step.problem === problemNumber,
          );
          const firstIndex = workflowSteps.findIndex(
            (step) => step.problem === problemNumber,
          );
          const doneCount = Math.max(
            0,
            Math.min(problemSteps.length, activeStep - firstIndex),
          );

          return (
            <article className={`problem-track ${meta.color}`} key={problemNumber}>
              <div className="track-heading">
                <span>0{problemNumber}</span>
                <div>
                  <p>{meta.short}</p>
                  <h3>{meta.title}</h3>
                </div>
                <strong>
                  {doneCount}/{problemSteps.length}
                </strong>
              </div>
              <p className="track-description">{meta.description}</p>
              <div className="mini-steps">
                {problemSteps.map((step) => {
                  const index = workflowSteps.indexOf(step);
                  const state =
                    index < activeStep
                      ? "complete"
                      : index === activeStep && !completed
                        ? "current"
                        : "waiting";
                  return (
                    <button
                      className={state}
                      key={step.id}
                      onClick={() => setActiveStep(index)}
                    >
                      <span>{state === "complete" ? "✓" : step.id}</span>
                      <strong>{step.title}</strong>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <section className="execution-panel">
        <div className="execution-head">
          <div>
            <p className="kicker">
              {completed ? "Simulation outcome" : `Executing ${currentStep.id}`}
            </p>
            <h3>
              {completed
                ? "All three workflows completed with human accountability."
                : currentStep.title}
            </h3>
          </div>
          <span className={completed ? "execution-state done" : "execution-state"}>
            <i /> {completed ? "Complete" : "Ready to execute"}
          </span>
        </div>

        {completed ? (
          <WorkflowOutcome jurisdiction={jurisdiction} />
        ) : (
          <div className="execution-body">
            <div className="execution-route">
              <span className={`problem-number p${currentStep.problem}`}>
                P{currentStep.problem}
              </span>
              <div>
                <span>Owner</span>
                <strong>{currentStep.owner}</strong>
              </div>
              <i>→</i>
              <div>
                <span>System</span>
                <strong>{currentStep.system}</strong>
              </div>
            </div>

            <div className="execution-cards">
              <article>
                <span className="execution-icon">A</span>
                <div>
                  <p>Action</p>
                  <strong>{currentStep.action}</strong>
                </div>
              </article>
              <article>
                <span className="execution-icon output">O</span>
                <div>
                  <p>Produced evidence</p>
                  <strong>
                    {currentStep.problem === 3 && currentStep.id === "P3.1"
                      ? `${jurisdiction} control pack and source identifiers attached`
                      : currentStep.output}
                  </strong>
                </div>
              </article>
              <article>
                <span className="execution-icon control">C</span>
                <div>
                  <p>Control gate</p>
                  <strong>{currentStep.control}</strong>
                </div>
              </article>
            </div>

            <div className="execution-log" aria-live="polite">
              <span>Execution log</span>
              <code>
                {`[READY] ${currentStep.id} · ${currentStep.owner} · policy RM-2.4 · ${jurisdiction}`}
              </code>
            </div>
          </div>
        )}
      </section>

      <section className="handoff-map">
        <div className="panel-heading compact">
          <div>
            <p className="kicker">Connected lifecycle</p>
            <h3>Where the three problems meet</h3>
          </div>
          <span className="audit-badge">12 auditable controls</span>
        </div>
        <div className="handoff-flow">
          <article className="p1">
            <span>P1 output</span>
            <strong>Score + reasons + evidence</strong>
          </article>
          <i>→</i>
          <article className="p2">
            <span>P2 consumes and produces</span>
            <strong>Prioritised case + officer decision</strong>
          </article>
          <i>→</i>
          <article className="p3">
            <span>P3 assures</span>
            <strong>Policy compliance + audit bundle</strong>
          </article>
          <i>↺</i>
          <article className="feedback">
            <span>Governed feedback</span>
            <strong>Validated outcome improves detection</strong>
          </article>
        </div>
      </section>
    </div>
  );
}

function WorkflowOutcome({
  jurisdiction,
}: {
  jurisdiction: "Singapore" | "United States";
}) {
  return (
    <div className="workflow-outcome">
      <div className="outcome-score">
        <span>Transaction risk</span>
        <strong>87</strong>
        <b>High · explained</b>
      </div>
      <div className="outcome-metrics">
        <article>
          <span>Case priority</span>
          <strong>#1</strong>
          <small>60-minute SLA</small>
        </article>
        <article>
          <span>Human decision</span>
          <strong>Escalate</strong>
          <small>Officer ID retained</small>
        </article>
        <article>
          <span>Jurisdiction</span>
          <strong>{jurisdiction}</strong>
          <small>Effective policy attached</small>
        </article>
        <article>
          <span>Audit completeness</span>
          <strong>100%</strong>
          <small>12/12 controls evidenced</small>
        </article>
      </div>
      <div className="outcome-note">
        <span>✓</span>
        <p>
          <strong>No autonomous financial-crime decision occurred.</strong>
          The score, AI assistance and policy controls supported a named
          officer’s disposition, which is now available for audit and model
          monitoring.
        </p>
      </div>
    </div>
  );
}

function CaseWorkspace({
  selectedCase,
  selectedId,
  onSelect,
  response,
  assistantMode,
  onAsk,
  query,
  setQuery,
  decision,
  setDecision,
}: {
  selectedCase: RiskCase;
  selectedId: string;
  onSelect: (id: string) => void;
  response: (typeof assistantResponses)[keyof typeof assistantResponses];
  assistantMode: keyof typeof assistantResponses;
  onAsk: (mode: keyof typeof assistantResponses) => void;
  query: string;
  setQuery: (query: string) => void;
  decision: string | null;
  setDecision: (decision: string | null) => void;
}) {
  return (
    <div className="case-layout">
      <aside className="case-list-panel" aria-label="Case queue">
        <div className="case-list-header">
          <div>
            <p className="kicker">Priority queue</p>
            <h2>12 open cases</h2>
          </div>
          <button className="filter-button" aria-label="Filter cases">
            ≡
          </button>
        </div>
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input placeholder="Search case or entity" />
        </label>
        <div className="case-stack">
          {cases.map((riskCase) => (
            <button
              className={
                riskCase.id === selectedId
                  ? "case-card selected"
                  : "case-card"
              }
              onClick={() => onSelect(riskCase.id)}
              key={riskCase.id}
            >
              <span className="case-card-top">
                <span>{riskCase.id}</span>
                <b className={`score-dot risk-${scoreBand(riskCase.score)}`}>
                  {riskCase.score}
                </b>
              </span>
              <strong>{riskCase.customer}</strong>
              <span>{riskCase.amount}</span>
              <small>
                {riskCase.pattern} · {riskCase.time}
              </small>
            </button>
          ))}
        </div>
      </aside>

      <div className="investigation">
        <section className="case-summary">
          <div className="case-title-row">
            <div className="case-identity">
              <div className="large-avatar">{selectedCase.initials}</div>
              <div>
                <div className="case-meta">
                  <span>{selectedCase.id}</span>
                  <span>•</span>
                  <span>{selectedCase.status}</span>
                </div>
                <h2>{selectedCase.customer}</h2>
                <p>{selectedCase.pattern}</p>
              </div>
            </div>
            <div className={`score-panel risk-${scoreBand(selectedCase.score)}`}>
              <span>Composite risk</span>
              <strong>{selectedCase.score}</strong>
              <b>{scoreBand(selectedCase.score)}</b>
            </div>
          </div>
          <div className="transaction-strip">
            <div>
              <span>Transaction</span>
              <strong>{selectedCase.amount}</strong>
            </div>
            <div>
              <span>Route</span>
              <strong>{selectedCase.route}</strong>
            </div>
            <div>
              <span>Detected</span>
              <strong>{selectedCase.time}</strong>
            </div>
            <div>
              <span>Screening</span>
              <strong className="clear-result">No direct match</strong>
            </div>
          </div>
        </section>

        <div className="investigation-grid">
          <div className="evidence-column">
            <section className="panel factor-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="kicker">Explainable score</p>
                  <h3>Risk factor breakdown</h3>
                </div>
                <span className="version-label">Policy RM-2.4</span>
              </div>
              <p className="section-intro">
                The score is additive and capped at 100. Every point can be
                traced to evidence, a rule and a model version.
              </p>
              <div className="factor-list">
                {selectedCase.factors.map((factor) => (
                  <article className="factor-row" key={factor.label}>
                    <span className={`factor-marker ${factor.tone}`} />
                    <div>
                      <strong>{factor.label}</strong>
                      <p>{factor.detail}</p>
                    </div>
                    <b>+{factor.points}</b>
                  </article>
                ))}
              </div>
              <div className="score-total">
                <span>Composite score</span>
                <strong>{selectedCase.score} / 100</strong>
              </div>
            </section>

            <section className="panel audit-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="kicker">Evidence trail</p>
                  <h3>How this case was created</h3>
                </div>
                <button className="text-button">Open audit log →</button>
              </div>
              <div className="audit-timeline">
                <div>
                  <span className="audit-dot completed">✓</span>
                  <p>
                    <strong>Transaction ingested from SAP S/4HANA</strong>
                    <small>14:21:03 · source record TX-882190</small>
                  </p>
                </div>
                <div>
                  <span className="audit-dot completed">✓</span>
                  <p>
                    <strong>Data quality and sanctions checks completed</strong>
                    <small>14:21:05 · Screening Agent v1.8</small>
                  </p>
                </div>
                <div>
                  <span className="audit-dot current">3</span>
                  <p>
                    <strong>Assigned to Investigation Lead</strong>
                    <small>14:21:07 · SLA due in 42 minutes</small>
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="assistant-panel">
            <div className="assistant-header">
              <div className="joule-mark" aria-hidden="true">
                J
              </div>
              <div>
                <span>Joule investigator</span>
                <strong>Grounded in this case</strong>
              </div>
              <span className="status-dot" />
            </div>

            <div className="assistant-body">
              <div className="assistant-intro">
                <span>{response.eyebrow}</span>
                <h3>{response.title}</h3>
                <p>{response.body}</p>
                <div className="assistant-callout">
                  <span aria-hidden="true">i</span>
                  {response.callout}
                </div>
              </div>

              <div className="quick-prompts">
                <p>Suggested prompts</p>
                <button
                  className={assistantMode === "explain" ? "active" : ""}
                  onClick={() => onAsk("explain")}
                >
                  Why is this high risk?
                </button>
                <button
                  className={assistantMode === "summarize" ? "active" : ""}
                  onClick={() => onAsk("summarize")}
                >
                  Summarise this case
                </button>
                <button
                  className={assistantMode === "sar" ? "active" : ""}
                  onClick={() => onAsk("sar")}
                >
                  Draft a SAR narrative
                </button>
              </div>
            </div>

            <form
              className="assistant-input"
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim().toLowerCase().includes("sar")) onAsk("sar");
                else if (query.trim().toLowerCase().includes("summ")) onAsk("summarize");
                else onAsk("explain");
              }}
            >
              <label htmlFor="assistant-query" className="sr-only">
                Ask Joule about this case
              </label>
              <input
                id="assistant-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about this case…"
              />
              <button type="submit" aria-label="Send prompt">
                ↑
              </button>
            </form>
          </aside>
        </div>

        <section className="decision-bar">
          <div>
            <span className="decision-lock">✓</span>
            <p>
              <strong>Human decision required</strong>
              <span>AI cannot release, escalate or file this case.</span>
            </p>
          </div>
          {decision ? (
            <div className="decision-confirmation" role="status">
              <strong>{decision}</strong>
              <span>Recorded with officer ID and timestamp</span>
              <button onClick={() => setDecision(null)}>Undo demo action</button>
            </div>
          ) : (
            <div className="decision-actions">
              <button
                className="secondary-button"
                onClick={() => setDecision("Released for processing")}
              >
                Release
              </button>
              <button
                className="primary-button danger"
                onClick={() => setDecision("Escalated to enhanced due diligence")}
              >
                Escalate case
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Architecture() {
  const layers = [
    {
      number: "01",
      title: "Experience",
      subtitle: "SAP Build Work Zone / SAP Build Apps",
      copy: "Investigator cockpit, risk dashboard and embedded Joule conversation.",
      tags: ["Case queue", "Score breakdown", "Human decision"],
    },
    {
      number: "02",
      title: "Agent & workflow",
      subtitle: "Joule Studio + SAP Build Process Automation",
      copy: "Screening, investigation, SAR drafting, approval routing and SLA escalation.",
      tags: ["Joule agents", "Officer approval", "Process rules"],
    },
    {
      number: "03",
      title: "Risk intelligence",
      subtitle: "SAP AI Core / governed model endpoint",
      copy: "Deterministic rules, narrow anomaly models and a weighted score with reason codes.",
      tags: ["Rules", "Anomaly model", "Score API"],
    },
    {
      number: "04",
      title: "Data foundation",
      subtitle: "SAP HANA Cloud",
      copy: "Transactions, customer profiles, case history, model evidence and immutable audit events.",
      tags: ["S/4HANA data", "Case history", "Evidence"],
    },
    {
      number: "05",
      title: "Governance & reporting",
      subtitle: "SAP Analytics Cloud + policy controls",
      copy: "Model health, operational KPIs, jurisdiction packs and regulator-ready evidence.",
      tags: ["Drift", "Fairness", "Audit export"],
    },
  ];

  return (
    <div className="architecture-page">
      <section className="architecture-hero">
        <div>
          <p className="kicker">Target operating model</p>
          <h2>One governed loop from transaction to decision.</h2>
          <p>
            The design joins detection accuracy, operational workflow and
            regulatory accountability without allowing generative AI to make
            the final financial-crime decision.
          </p>
        </div>
        <div className="architecture-principles">
          <span>Explain every score</span>
          <span>Escalate uncertainty</span>
          <span>Log every action</span>
          <span>Keep humans accountable</span>
        </div>
      </section>

      <div className="architecture-content">
        <section className="stack-panel">
          <div className="section-heading">
            <div>
              <span>Reference architecture</span>
              <h3>SAP-aligned solution layers</h3>
            </div>
            <div className="legend">
              <i /> Bank-owned control <i /> SAP capability
            </div>
          </div>
          <div className="layer-stack">
            {layers.map((layer) => (
              <article className="architecture-layer" key={layer.number}>
                <span className="layer-number">{layer.number}</span>
                <div className="layer-title">
                  <strong>{layer.title}</strong>
                  <span>{layer.subtitle}</span>
                </div>
                <p>{layer.copy}</p>
                <div className="layer-tags">
                  {layer.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="source-band">
            <span>Source systems</span>
            <strong>SAP S/4HANA</strong>
            <strong>SAP Service Cloud</strong>
            <strong>Customer & KYC feeds</strong>
            <strong>Sanctions / watchlists</strong>
          </div>
        </section>

        <aside className="governance-panel">
          <div className="section-heading">
            <div>
              <span>Control plane</span>
              <h3>AI governance gates</h3>
            </div>
          </div>
          <div className="control-list">
            <Control
              step="G1"
              title="Input guard"
              copy="Validate schema, mandatory KYC fields, prompt content and data entitlements."
            />
            <Control
              step="G2"
              title="Model guard"
              copy="Version pinning, approved thresholds, drift checks and champion–challenger testing."
            />
            <Control
              step="G3"
              title="Output guard"
              copy="Reason-code coverage, grounded citations, hallucination checks and sensitive-data controls."
            />
            <Control
              step="G4"
              title="Decision guard"
              copy="Named officer review is mandatory for hold, release, escalation and SAR filing."
            />
          </div>
          <div className="guard-note">
            <span>Llama Guard 3</span>
            <p>
              Suitable as one content-safety control around prompts and
              responses—not as the risk orchestrator or compliance authority.
            </p>
          </div>
        </aside>
      </div>

      <section className="workflow-panel">
        <div className="section-heading">
          <div>
            <span>Agent workflow</span>
            <h3>Investigate → suggest → decide → learn</h3>
          </div>
          <p>Accept, reject or ask for more evidence until resolved.</p>
        </div>
        <div className="workflow-rail">
          {[
            ["1", "Ingest", "HANA Cloud validates and standardises the transaction."],
            ["2", "Detect", "Rules and narrow models generate evidence-backed signals."],
            ["3", "Prioritise", "Risk score and SLA place the case in the officer queue."],
            ["4", "Assist", "Joule explains, summarises and drafts from approved evidence."],
            ["5", "Decide", "Officer accepts, rejects or requests additional evidence."],
            ["6", "Audit & learn", "Outcome, rationale and model version are retained."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="bottom-grid">
        <section className="panel regulatory-panel">
          <div className="panel-heading compact">
            <div>
              <p className="kicker">Regulatory grounding</p>
              <h3>Jurisdiction packs, not hard-coded policy</h3>
            </div>
          </div>
          <div className="jurisdictions">
            <article>
              <span>Singapore</span>
              <strong>MAS FEAT + AI model risk guidance</strong>
              <p>
                Fairness, ethics, accountability, transparency, lifecycle
                governance and independent validation.
              </p>
              <a
                href="https://www.mas.gov.sg/publications/monographs-or-information-paper/2018/FEAT"
                target="_blank"
                rel="noreferrer"
              >
                Official MAS source ↗
              </a>
            </article>
            <article>
              <span>United States</span>
              <strong>SR 11-7 + FinCEN SAR requirements</strong>
              <p>
                Effective challenge, validation, model inventory, documentation
                and retention of SAR supporting evidence.
              </p>
              <a
                href="https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm"
                target="_blank"
                rel="noreferrer"
              >
                Federal Reserve source ↗
              </a>
            </article>
          </div>
        </section>

        <section className="panel boundary-panel">
          <div className="panel-heading compact">
            <div>
              <p className="kicker">Decision boundary</p>
              <h3>What AI may—and may not—do</h3>
            </div>
          </div>
          <div className="boundary-columns">
            <div>
              <span className="allowed">Allowed</span>
              <p>Score · prioritise · explain · summarise · draft</p>
            </div>
            <div>
              <span className="blocked">Human only</span>
              <p>Release · hold · escalate · report · override policy</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Control({
  step,
  title,
  copy,
}: {
  step: string;
  title: string;
  copy: string;
}) {
  return (
    <article>
      <span>{step}</span>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </article>
  );
}
