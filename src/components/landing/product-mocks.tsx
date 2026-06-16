import { Fragment } from "react";
import { Download, FileText } from "lucide-react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import {
  DottedLabel,
  MockBtn,
  mockDateClassName,
  OwnerAvatar,
  PreviewFoot,
  PreviewShell,
  rowRule,
  SourceMark,
  tdClass,
  thClass,
} from "@/components/landing/landing-preview-shared";

export { DashboardOverviewPreview } from "@/components/landing/product-mocks-dashboard";

/* ─── §3 Confirm details — source-to-record review ───────────────────────────
   The trust-conversion artifact: a suggested value, the located source clause
   it came from, and the confirm/edit decision. Amber marks the located source
   text; the value is not trusted until confirmed (footer trust line). */
export function ReviewFieldsPreview() {
  return (
    <PreviewShell
      variant="source"
      breadcrumb={["Northstar workspace", "Contracts", "Northstar Services MSA"]}
      title="Renewal date"
      footer={
        <PreviewFoot
          icon={FileText}
          label="Suggested details are not used until confirmed"
          meta="Northstar workspace"
        />
      }
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Suggested detail</p>
          <span className="inline-flex items-center gap-1 rounded-[2px] border border-[color:color-mix(in_oklab,var(--warning-ink)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--surface-raised))] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--warning-ink)]">
            Source found
          </span>
        </div>
        <p className="mt-2 text-[18px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[20px]">
          March 12, 2027
        </p>
        <p className="mt-1 font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
          Calculated from Mar 12, 2024 + 3-year initial term
        </p>
        {/* Located source clause — warm document paper, amber underline on the
            located text (release-state §Source-Backed Language). */}
        <div className="mt-3 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          &ldquo;The Initial Term shall commence on <SourceMark>March 12, 2024</SourceMark> and continue for three (3) years&hellip;&rdquo;
        </div>
        <p className="mt-3 text-[11px] leading-snug text-[var(--text-tertiary)]">
          <span className="font-semibold text-[var(--text-secondary)]">Where this is used:</span>{" "}
          renewal reminders and the upcoming-renewals report.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <MockBtn kind="primary">Confirm detail</MockBtn>
          <MockBtn kind="secondary">Edit</MockBtn>
          <span className="ml-auto font-mono text-[11px] text-[var(--text-tertiary)]">Priya R.</span>
        </div>
      </div>
    </PreviewShell>
  );
}

/* ─── §4 Review dates — renewal and notice timeline with provenance ──────────
   Every row carries its trust state (Confirmed / Calculated / Suggested) so
   the reader can see which dates are operationally trusted. */
export function UpcomingDatesPreview() {
  const rows: Array<{
    name: string;
    owner: string;
    date: string;
    status: SemanticStatus;
    statusLabel: string;
  }> = [
    {
      name: "Northstar Services MSA · Renewal",
      owner: "Priya Raman · Finance",
      date: "Jan 11",
      status: "healthy",
      statusLabel: "Confirmed",
    },
    {
      name: "Summit Office Lease · Notice deadline",
      owner: "Tomas Klein · Ops",
      date: "Jan 15",
      status: "warning",
      statusLabel: "Calculated",
    },
    {
      name: "Brightline Vendor Agreement · Renewal",
      owner: "Marco Diaz · Legal",
      date: "Feb 20",
      status: "in_review",
      statusLabel: "Suggested",
    },
  ];
  return (
    <PreviewShell
      variant="queue"
      breadcrumb={["Northstar workspace", "Renewals"]}
      title="Renewal and notice dates"
      titleAction={
        <span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">
          6 dates in view
        </span>
      }
      footer={
        <PreviewFoot
          icon={FileText}
          label="Calculated dates show the inputs they came from"
          meta="Northstar workspace"
        />
      }
    >
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-3 first:border-t-0"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] leading-tight">
              <DottedLabel
                value={r.name}
                headClassName="font-semibold text-[var(--text-primary)]"
                tailClassName="text-[var(--text-secondary)]"
              />
            </p>
            <p className="mt-1 truncate text-[12px] leading-tight text-[var(--text-tertiary)]">
              <DottedLabel value={r.owner} />
            </p>
          </div>
          <span className="flex w-[10.5rem] shrink-0 items-center justify-end gap-3">
            <StatusBadge status={r.status} className="shrink-0 text-[10.5px]">
              {r.statusLabel}
            </StatusBadge>
            <span className={mockDateClassName}>{r.date}</span>
          </span>
        </div>
      ))}
    </PreviewShell>
  );
}

/* ─── §5 Create tasks — the follow-up queue ──────────────────────────────────
   Tasks (not "work"); states use the release vocabulary: Due within 7 days,
   Cannot proceed, Unassigned. */
export function WorkQueuePreview() {
  const rows: Array<{
    title: string;
    owner: string;
    due: string;
    status: SemanticStatus;
    statusLabel: string;
  }> = [
    {
      title: "Send renewal notice — Northstar Services",
      owner: "PR",
      due: "Jan 1",
      status: "info",
      statusLabel: "Due within 7 days",
    },
    {
      title: "Collect insurance certificate — Brightline",
      owner: "MD",
      due: "Jan 8",
      status: "blocked",
      statusLabel: "Cannot proceed",
    },
    {
      title: "Confirm Summit lease amendment",
      owner: "—",
      due: "Jan 14",
      status: "warning",
      statusLabel: "Unassigned",
    },
  ];
  return (
    <PreviewShell
      variant="queue"
      breadcrumb={["Northstar workspace", "Tasks"]}
      title="Tasks"
      titleAction={
        <span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">
          Open tasks — 3 of 14
        </span>
      }
      footer={
        <PreviewFoot
          icon={FileText}
          label="Each task carries an owner, a due date, and a state"
          meta="Northstar workspace"
        />
      }
    >
      {rows.map((r) => (
        <div
          key={r.title}
          className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-3 first:border-t-0"
        >
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-primary)]">
            {r.title}
          </span>
          <span className="flex w-[10.5rem] shrink-0 items-center justify-end gap-2.5">
            <StatusBadge status={r.status} className="shrink-0 text-[10.5px]">
              {r.statusLabel}
            </StatusBadge>
            {r.owner === "—" ? (
              <span className="w-[1.375rem] text-center font-mono text-[12px] text-[var(--text-tertiary)]">
                —
              </span>
            ) : (
              <OwnerAvatar initials={r.owner} />
            )}
            <span className={mockDateClassName}>{r.due}</span>
          </span>
        </div>
      ))}
    </PreviewShell>
  );
}

/* ─── §6 Request evidence — proof collection ─────────────────────────────────
   Neutral evidence examples (no implied security claims): a certificate, a
   signed notice, a tax form. Received is distinct from accepted. */
export function EvidenceRequestPreview() {
  const rows: Array<{
    label: string;
    owner: string;
    due: string;
    status: SemanticStatus;
    statusLabel: string;
  }> = [
    {
      label: "Insurance certificate — Brightline",
      owner: "MD",
      due: "Jan 8",
      status: "healthy",
      statusLabel: "Received",
    },
    {
      label: "Signed renewal notice — Northstar",
      owner: "PR",
      due: "Jan 20",
      status: "info",
      statusLabel: "Requested",
    },
    {
      label: "Updated W-9 — Harbor Payroll",
      owner: "SO",
      due: "Jan 2",
      status: "warning",
      statusLabel: "Overdue",
    },
  ];
  return (
    <PreviewShell
      variant="queue"
      breadcrumb={["Northstar workspace", "Evidence"]}
      title="Evidence requests"
      titleAction={
        <span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">
          3 open requests
        </span>
      }
      footer={
        <PreviewFoot
          icon={FileText}
          label="Received proof is reviewed before it is accepted"
          meta="Northstar workspace"
        />
      }
    >
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-3 first:border-t-0"
        >
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-primary)]">
            {r.label}
          </span>
          <span className="flex w-[10.5rem] shrink-0 items-center justify-end gap-2.5">
            <StatusBadge status={r.status} className="shrink-0 text-[10.5px]">
              {r.statusLabel}
            </StatusBadge>
            <OwnerAvatar initials={r.owner} />
            <span className={mockDateClassName}>{r.due}</span>
          </span>
        </div>
      ))}
    </PreviewShell>
  );
}

/* ─── §7 Export reports — operational report preview ─────────────────────────
   The export ledger: the rows shown are the rows exported. The count names
   its object type (contracts). */
export function ReportsExportPreview() {
  const rows: Array<{ contract: string; date: string; owner: string }> = [
    { contract: "Northstar Services MSA", date: "Mar 12", owner: "PR" },
    { contract: "Brightline Vendor Agreement", date: "May 20", owner: "MD" },
    { contract: "Summit Office Lease", date: "Apr 15", owner: "TK" },
    { contract: "Harbor Payroll Services", date: "Jun 02", owner: "SO" },
  ];
  return (
    <PreviewShell
      variant="ledger"
      breadcrumb={["Northstar workspace", "Reports", "Upcoming renewals"]}
      title="Upcoming renewals"
      titleAction={
        <span className="inline-flex items-center gap-1 rounded-[3px] border border-[color:color-mix(in_oklab,var(--success-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-ink)_8%,var(--surface-raised))] px-2 py-1 text-[11px] font-semibold text-[var(--success-ink)]">
          <Download className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
          Export CSV
        </span>
      }
      footer={
        <PreviewFoot
          icon={FileText}
          label="Exports the rows shown — 4 of 12 contracts"
          meta="Northstar workspace"
        />
      }
    >
      <div className="grid grid-cols-[1.5fr_auto_auto]">
        <span className={thClass}>Contract</span>
        <span className={`${thClass} text-right`}>Renewal</span>
        <span className={`${thClass} text-right`}>Owner</span>
        {rows.map((r) => (
          <Fragment key={r.contract}>
            <span className={`${tdClass} ${rowRule} min-w-0 font-semibold text-[var(--text-primary)]`}>
              <span className="truncate">{r.contract}</span>
            </span>
            <span className={`${tdClass} ${rowRule} justify-end font-mono text-[12.5px] tabular-nums text-[var(--text-tertiary)]`}>
              {r.date}
            </span>
            <span className={`${tdClass} ${rowRule} justify-end`}>
              <OwnerAvatar initials={r.owner} />
            </span>
          </Fragment>
        ))}
      </div>
    </PreviewShell>
  );
}
