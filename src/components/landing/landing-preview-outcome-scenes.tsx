import { Fragment } from "react";
import { Check, Lock } from "lucide-react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import {
  countMetaClass,
  DottedLabel,
  mockDateClassName,
  MockBtn,
  PreviewFoot,
  PreviewShell,
  RowActionQuiet,
  rowRule,
  selectedRowClass,
  SelectedBar,
  tdTight,
  thClass,
  zebraRowClass,
} from "@/components/landing/landing-preview-shared";

const attentionSignals: ReadonlyArray<{
  count: string;
  label: string;
  consequence?: string;
}> = [
  {
    count: "4",
    label: "contracts need review",
    consequence: "before reminders and reports use them.",
  },
  { count: "11", label: "renewal and notice dates are in view" },
  { count: "2", label: "tasks cannot proceed" },
] as const;

export function AttentionPreview() {
  const queue: Array<{
    name: string;
    detail: string;
    date: string;
    status: SemanticStatus;
    statusLabel: string;
    selected?: boolean;
  }> = [
    {
      name: "Northwind Analytics MSA",
      detail: "Renewal date · Priya Raman",
      date: "Jan 11",
      status: "in_review",
      statusLabel: "Needs confirmation",
      selected: true,
    },
    {
      name: "Beacon MSA",
      detail: "Notice window · Tess Karim",
      date: "Feb 19",
      status: "in_review",
      statusLabel: "Suggested",
    },
    {
      name: "Cardinal Facilities DPA",
      detail: "Owner · unassigned",
      date: "Feb 02",
      status: "warning",
      statusLabel: "Missing owner",
    },
  ];
  return (
    <PreviewShell
      variant="queue"
      breadcrumb={["Northwind workspace", "Dashboard"]}
      title="Operational attention"
      titleAction={<span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">this week</span>}
      footer={
        <PreviewFoot
          label="Reminders and reports run from the same confirmed dates"
          meta="Northwind workspace"
        />
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:divide-x lg:divide-y-0">
        {/* Count statements — number + object + condition, NOT a table
            (design pass directive 35): no column header row, the counts read as
            ranked conditions and the selected one states its consequence.
            Rows stretch to fill the column so the ledger carries no dead
            area below the last count (design pass directive 32); the selected
            treatment is the shared recipe (21). */}
        <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
          {attentionSignals.map((s, i) => (
            <li
              key={s.label}
              className={`flex flex-1 items-center gap-6 px-6 py-3.5 ${
                i === 0 ? selectedRowClass : ""
              }`}
            >
              {i === 0 ? <SelectedBar /> : null}
              <span className="w-[5rem] shrink-0 text-right font-mono text-[48px] font-bold leading-none tabular-nums text-[var(--text-primary)]">
                {s.count}
              </span>
              <p className="text-[16px] leading-[1.5] text-[var(--text-secondary)]">
                <span className={i === 0 ? "font-semibold text-[var(--text-primary)]" : "font-medium"}>
                  {s.label}
                </span>
                {s.consequence ? (
                  <span className="mt-0.5 block text-[13px] leading-snug text-[var(--text-tertiary)]">
                    {s.consequence}
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
        {/* The selected count's queue — wider panel, two clean lines per
            contract, no truncated names (design pass directive 38). */}
        <div className="flex flex-col">
          <div className={`flex items-baseline justify-between gap-3 bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] px-3.5 py-2`}>
            <span className="text-[12px] font-bold text-[var(--text-primary)]">
              Contracts needing review
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-[var(--text-secondary)]">
              3 of 4 shown
            </span>
          </div>
          {queue.map((q) => (
            <div
              key={q.name}
              className={`px-3.5 py-2.5 ${rowRule} ${q.selected ? selectedRowClass : ""}`}
            >
              {q.selected ? <SelectedBar /> : null}
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-tight text-[var(--text-primary)]">
                  {q.name}
                </p>
                <span className={mockDateClassName}>{q.date}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[12px] leading-tight text-[var(--text-tertiary)]">
                  <DottedLabel value={q.detail} />
                </p>
                <StatusBadge status={q.status} className="shrink-0 text-[10.5px]">
                  {q.statusLabel}
                </StatusBadge>
              </div>
            </div>
          ))}
          {/* One report-export row — reporting proof, compressed
              (directive 39). */}
          <div className={`flex items-center justify-between gap-3 ${rowRule} bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] px-3.5 py-2`}>
            <span className="text-[12px] font-bold text-[var(--text-primary)]">Report export</span>
            <span className="text-[12px] font-semibold tabular-nums text-[var(--text-secondary)]">
              latest of 2 exported
            </span>
          </div>
          <div className={`flex items-start justify-between gap-3 ${rowRule} px-3.5 py-2`}>
            <span className="min-w-0">
              <span className="block truncate font-mono text-[12.5px] text-[var(--text-primary)]">
                renewals_q1.csv
              </span>
              <span className="mt-0.5 block text-[11.5px] tabular-nums text-[var(--text-tertiary)]">
                12 contracts · exported Jan 02
              </span>
            </span>
            <RowActionQuiet>Download</RowActionQuiet>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Best-fit preview — the bounded first contract set, ready to import.
   ──────────────────────────────────────────────────────────────────────────── */

export function FirstSetPreview() {
  /* One message (directives 45-46): a bounded first set is ready to import.
     Three contracts, one readiness mark on the selected row, one action. */
  const rows = [
    { contract: "Northwind Analytics MSA", owner: "Priya Raman", dates: "Renewal + notice", selected: true },
    { contract: "Beacon MSA", owner: "Tess Karim", dates: "Renewal + notice" },
    { contract: "Summit Insurance Lease", owner: "Devon Reed", dates: "Renewal" },
  ];
  return (
    <PreviewShell
      variant="ledger"
      breadcrumb={["Northwind workspace", "Contracts", "Import"]}
      title="First contract set"
      titleAction={
        <span className={countMetaClass}>
          32 contracts selected
        </span>
      }
      footer={<PreviewFoot icon={Lock} label="Files are workspace-scoped" meta="Northwind workspace" />}
    >
      {/* Contract column wide enough that the selected name never
          truncates (design pass directive 40). */}
      <div className="grid grid-cols-[1.3fr_0.8fr_0.5fr] md:grid-cols-[1.5fr_0.7fr_0.9fr_0.45fr]">
        <span className={thClass}>Contract</span>
        <span className={`${thClass} hidden md:block`}>Owner</span>
        <span className={thClass}>Key dates</span>
        <span className={`${thClass} text-right`}>Ready</span>
        {rows.map((r, ri) => {
          const sel = r.selected ? selectedRowClass : ri % 2 === 1 ? zebraRowClass : "";
          return (
            <Fragment key={r.contract}>
              <span className={`${tdTight} ${rowRule} ${sel} min-w-0 font-semibold text-[var(--text-primary)]`}>
                {r.selected ? <SelectedBar /> : null}
                <span className="truncate">{r.contract}</span>
              </span>
              <span className={`${tdTight} ${rowRule} ${sel} hidden md:flex`}>{r.owner}</span>
              <span className={`${tdTight} ${rowRule} ${sel}`}>{r.dates}</span>
              <span className={`${tdTight} ${rowRule} ${sel} justify-end`}>
                {r.selected ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--success-ink)]">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                    Ready
                  </span>
                ) : (
                  <span className="text-[12.5px] text-[var(--text-tertiary)]">Ready</span>
                )}
              </span>
            </Fragment>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-4 py-2.5">
        <MockBtn kind="primary">Import first set</MockBtn>
        <span className="ml-auto font-mono text-[11.5px] text-[var(--text-tertiary)]">first_set.csv</span>
      </div>
    </PreviewShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Closing preview — access review as the controlled admin surface it is.
   ──────────────────────────────────────────────────────────────────────────── */

export function AccessReviewPreview() {
  /* Compact approval record (directive 53): four numbered steps; sublines
     only where the label alone is not enough. */
  const rows: Array<{
    title: string;
    detail?: string;
    status?: SemanticStatus;
    statusLabel?: string;
  }> = [
    {
      title: "Request received",
      detail: "No account is created at this step",
      status: "healthy",
      statusLabel: "Received",
    },
    {
      title: "Fit context captured",
    },
    {
      title: "Contract data sensitivity reviewed",
      status: "info",
      statusLabel: "Reviewed by a person",
    },
    {
      title: "Workspace starts",
      detail: "Bounded first contract set, paid continuation",
      status: "in_review",
      statusLabel: "Workspace pending",
    },
  ];
  return (
    <PreviewShell
      variant="access"
      breadcrumb={["Oblixa", "Access review"]}
      title="Access review"
      footer={<PreviewFoot icon={Lock} label="Reviewed before workspace access" />}
    >
      <ol className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]">
        {rows.map((r, i) => (
          /* Fixed three-column row grid so the state plates rank in one
             precise right column (design pass directive 61). */
          <li key={r.title} className="grid grid-cols-[1.5rem_minmax(0,1fr)_8.5rem] items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-[12px] font-bold tabular-nums text-[var(--text-tertiary)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
                {r.title}
              </p>
              {r.detail ? (
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--text-tertiary)]">
                  {r.detail}
                </p>
              ) : null}
            </div>
            <span className="flex justify-end">
              {r.status && r.statusLabel ? (
                <StatusBadge status={r.status} className="text-[10.5px]">
                  {r.statusLabel}
                </StatusBadge>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </PreviewShell>
  );
}
