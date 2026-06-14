import { Fragment, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import {
  DottedLabel,
  mockDateClassName,
  MockBtn,
  PreviewFoot,
  PreviewShell,
  rowRule,
  selectedRowClass,
  SelectedBar,
  tdClass,
  thClass,
} from "@/components/landing/landing-preview-shared";

export function ManualTrackerMock() {
  /* Deliberately NOT the product shell (directives 23-26): a schematic
     manual evidence board. Four fragments, each labeled with its problem;
     oxblood appears only on the unresolved value and the missing decision. */
  /* Each fragment carries the numeral of the failure row it stages
     (directive 8) — subtle mono refs, not boxed markers. */
  const zones: Array<{
    ref: string;
    source: string;
    problem: string;
    body: ReactNode;
  }> = [
    {
      ref: "01",
      source: "renewals.xlsx",
      problem: "date lives here",
      body: (
        <p className="mt-1.5 truncate font-mono text-[13px] leading-snug text-[var(--text-primary)]">
          Northwind MSA · renewal: <span className="text-[var(--danger-ink)]">check w/ legal</span>
        </p>
      ),
    },
    {
      ref: "02",
      source: "MSA §9.2 · p. 14",
      problem: "source buried",
      body: (
        <p className="lp-serif mt-1.5 text-[14px] font-normal leading-[1.55] text-[var(--text-primary)]">
          “…sixty (60) days written notice…”
        </p>
      ),
    },
    {
      ref: "04",
      source: "Inbox",
      problem: "decision missing",
      body: (
        <p className="mt-1.5 truncate font-mono text-[13px] leading-snug text-[var(--text-primary)]">
          RE: RE: FW: Northwind renewal · 23 replies
        </p>
      ),
    },
    {
      ref: "05",
      source: "Q2_report.xlsx",
      problem: "report rebuilt",
      body: (
        <p className="mt-1.5 font-mono text-[13px] leading-snug text-[var(--text-primary)]">
          4 hours, by hand, every quarter
        </p>
      ),
    },
  ];
  /* Solid outer boundary, fine dashed interior grid (design pass directive 11) —
     deliberate evidence board, not unfinished wireframe. overflow-hidden
     keeps interior hairlines inside the frame (design pass directive 2). */
  return (
    <figure
      aria-hidden
      className="overflow-hidden rounded-[2px] border border-[var(--border-contrast)] bg-[color:color-mix(in_oklab,var(--surface-inset)_38%,var(--surface-raised))]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--border-contrast)] px-4 py-2.5">
        <span className="text-[15px] font-semibold text-[var(--text-primary)]">Manual tracker</span>
        <span className="text-[12px] font-semibold tabular-nums text-[var(--danger-ink)]">
          6 entries, no confirmed source
        </span>
      </div>
      <div className="grid sm:grid-cols-[1.15fr_0.85fr]">
        {zones.map((z, i) => (
          <div
            key={z.source}
            className={`p-4 sm:p-5 ${
              i < 2
                ? "border-b border-dashed border-[var(--border-contrast)]"
                : i === 2
                  ? "border-b border-dashed border-[var(--border-contrast)] sm:border-b-0"
                  : ""
            } ${
              i % 2 === 0 ? "sm:border-r sm:border-dashed sm:border-[var(--border-contrast)]" : ""
            }`}
          >
            {/* The problem annotation is the point — every fragment carries
                its label in the SAME position AND the same style: header
                row, top right, steel (design pass directives 4-5); oxblood stays on
                the board head count and the in-body evidence only. */}
            <p className="flex h-[18px] items-baseline justify-between gap-x-3">
              <span className="inline-flex min-w-0 items-baseline gap-2 font-mono text-[11.5px] leading-none tracking-[0.04em] text-[var(--text-secondary)]">
                <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-[var(--text-tertiary)]">
                  {z.ref}
                </span>
                <span className="truncate">{z.source}</span>
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold leading-none text-[var(--text-secondary)]">
                {z.problem}
              </span>
            </p>
            {z.body}
          </div>
        ))}
      </div>
    </figure>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Workflow step previews — each step is a real Oblixa surface with its own
   visual role (inventory ledger, source inspection, ownership queue,
   follow-up queue, export sheet), and the same contract stays selected
   from import to report.
   ──────────────────────────────────────────────────────────────────────────── */

export function ContractsPreview() {
  /* One message (directives 20-22): imported records become an inventory.
     Three columns, one selected contract, one action. */
  const rows: Array<{
    contract: string;
    owner: string;
    status: SemanticStatus;
    statusLabel: string;
    selected?: boolean;
  }> = [
    {
      contract: "Meridian Logistics MSA",
      owner: "Sasha Olin",
      status: "healthy",
      statusLabel: "Confirmed",
    },
    {
      contract: "Northwind Analytics MSA",
      owner: "Priya Raman",
      status: "in_review",
      statusLabel: "Suggested",
      selected: true,
    },
    {
      contract: "Cardinal Facilities DPA",
      owner: "—",
      status: "warning",
      statusLabel: "Missing owner",
    },
  ];
  return (
    <PreviewShell
      variant="ledger"
      breadcrumb={["Northwind workspace", "Contracts"]}
      title="Contracts"
      titleAction={<MockBtn kind="primary">Import contracts</MockBtn>}
      className="lg:flex lg:h-full lg:flex-col"
      footer={<PreviewFoot icon={FileText} label="Files stay attached to each contract" meta="Northwind workspace" />}
    >
      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.8fr]">
          <span className={thClass}>Contract</span>
          <span className={thClass}>Owner</span>
          <span className={thClass}>Review status</span>
          {rows.map((r) => {
            const sel = r.selected ? selectedRowClass : "";
            return (
              <Fragment key={r.contract}>
                <span className={`${tdClass} ${rowRule} ${sel} min-w-0 font-semibold text-[var(--text-primary)]`}>
                  {r.selected ? <SelectedBar /> : null}
                  <span className="truncate">{r.contract}</span>
                </span>
                <span className={`${tdClass} ${rowRule} ${sel}`}>{r.owner}</span>
                <span className={`${tdClass} ${rowRule} ${sel}`}>
                  <StatusBadge status={r.status} className="text-[10.5px]">
                    {r.statusLabel}
                  </StatusBadge>
                </span>
              </Fragment>
            );
          })}
        </div>
        {/* Compact import summary — why import matters: files and records
            arrive together (design pass directives 23-24). */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] px-3.5 py-2">
          <span className="font-mono text-[11.5px] text-[var(--text-secondary)]">
            tracker.csv · 12 contracts imported
          </span>
          <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
            files attached to each contract
          </span>
        </div>
      </div>
    </PreviewShell>
  );
}


export function AttentionMiniPreview() {
  const groups: Array<{
    group: string;
    scope: string;
    name: string;
    owner: string;
    date: string;
    status: SemanticStatus;
    statusLabel: string;
    selected?: boolean;
  }> = [
    {
      group: "Notice deadlines",
      scope: "11 dates in view",
      name: "Northwind Analytics · MSA",
      owner: "Priya Raman · Finance",
      date: "Jan 11",
      /* Neutral plate (design pass directive 28): the selected row carries the
         urgency; only the failure state stays oxblood. */
      status: "info",
      statusLabel: "Due within 7 days",
      selected: true,
    },
    {
      group: "Evidence requests",
      scope: "3 missing files",
      name: "Northwind · DPA",
      owner: "Marco Diaz · Legal",
      date: "Jan 15",
      status: "info",
      statusLabel: "Requested",
    },
    {
      group: "Problems",
      scope: "2 tasks cannot proceed",
      name: "Summit Insurance · NDA",
      owner: "Devon Reed · Legal",
      date: "Jan 27",
      status: "blocked",
      statusLabel: "Cannot proceed",
    },
  ];
  return (
    <PreviewShell
      variant="queue"
      breadcrumb={["Northwind workspace", "Dashboard"]}
      title="Contract follow-up queue"
      titleAction={<span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">this week</span>}
      className="lg:flex lg:h-full lg:flex-col"
      footer={
        <PreviewFoot icon={FileText} label="Renewals and open requirements export as CSV reports" meta="Northwind workspace" />
      }
    >
      <div className="lg:min-h-0 lg:flex-1">
        {groups.map((g) => (
          <Fragment key={g.group}>
            <p className={`flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] px-4 py-1.5 first:border-t-0`}>
              <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{g.group}</span>
              <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">{g.scope}</span>
            </p>
            <div className={`flex items-center gap-3 px-4 py-3 ${g.selected ? selectedRowClass : ""}`}>
              {g.selected ? <SelectedBar /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] leading-tight">
                  <DottedLabel
                    value={g.name}
                    headClassName="font-semibold text-[var(--text-primary)]"
                    tailClassName="text-[var(--text-secondary)]"
                  />
                </p>
                <p className="mt-1 truncate text-[12px] leading-tight text-[var(--text-tertiary)]">
                  <DottedLabel value={g.owner} />
                </p>
              </div>
              {/* Fixed right state column (design pass directive 27): names get the
                  remaining width instead of competing with the plates. */}
              <span className="flex w-[11.5rem] shrink-0 items-center justify-end gap-3">
                <StatusBadge status={g.status} className="shrink-0 text-[10.5px]">
                  {g.statusLabel}
                </StatusBadge>
                <span className={mockDateClassName}>{g.date}</span>
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </PreviewShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Capabilities — source-to-record inspection: the signed page on one side,
   the detail ledger and its operational consequence on the other.
   ──────────────────────────────────────────────────────────────────────────── */
