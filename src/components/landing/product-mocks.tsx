import { BarChart3, Bell, Check, Download, FileText, ShieldCheck } from "lucide-react";
import { MockShell } from "@/components/landing/product-mock-shell";

export { DashboardOverviewPreview } from "@/components/landing/product-mocks-dashboard";

export function ReviewFieldsPreview() {
  return (
    <MockShell
      caption="Field review"
      tone="warm"
      chromePath="oblixa.com/contracts/acme-msa/fields"
    >
      <div className="relative h-full rounded-xl border border-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            Renewal date
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--accent-strong)]">
            SOURCE LOCATED
          </span>
        </div>
        <p className="mt-2 text-[16px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[20px]">
          March 12, 2027
        </p>
        <p className="mt-1 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
          Initial term: Mar 12, 2024 + 3 yr
        </p>
        <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          &ldquo;The Initial Term shall commence on{" "}
          <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
            March 12, 2024
          </span>{" "}
          and continue for three (3) years…&rdquo;
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-fg)]">
            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
            Approve
          </span>
          <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Edit
          </span>
          <span className="ml-auto font-mono text-[11px] text-[var(--text-tertiary)]">
            Marco D.
          </span>
        </div>
      </div>
    </MockShell>
  );
}

export function UpcomingDatesPreview() {
  const reminders = [
    { name: "Acme renewal", days: "11d", owner: "SO", date: "Apr 12", tone: "accent" as const },
    { name: "Hooli notice", days: "14d", owner: "TK", date: "Apr 15", tone: "green" as const },
    { name: "Initech audit", days: "49d", owner: "MD", date: "May 20", tone: "amber" as const },
  ];
  return (
    <MockShell
      caption="Upcoming dates"
      tone="warm"
      chromePath="oblixa.com/dashboard/upcoming"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Upcoming reminders
        </p>
        <ul className="space-y-1.5">
          {reminders.map((r) => {
            const palette =
              r.tone === "amber"
                ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,var(--surface-raised))] text-[var(--warning-ink)]"
                : r.tone === "green"
                  ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,var(--surface-raised))] text-[var(--success-ink)]"
                  : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,var(--surface-raised))] text-[var(--accent-strong)]";
            return (
              <li
                key={r.name}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${palette}`}>
                  <Bell className="h-3 w-3" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {r.name} <span className="text-[var(--text-tertiary)]">in {r.days}</span>
                </span>
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                  {r.owner}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                  {r.date}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </MockShell>
  );
}

export function WorkQueuePreview() {
  const items = [
    { title: "Send renewal notice — Acme", owner: "SO", due: "Apr 1", tone: "accent" as const },
    { title: "Collect SOC 2 attestation — Initech", owner: "MD", due: "Apr 8", tone: "amber" as const },
    { title: "Approve Hooli amendment", owner: "TK", due: "Apr 14", tone: "green" as const },
  ];
  return (
    <MockShell
      caption="Work queue"
      tone="warm"
      chromePath="oblixa.com/work?owner=me"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Open work — 3 of 14
        </p>
        <ul className="space-y-1.5">
          {items.map((r) => {
            const palette =
              r.tone === "amber"
                ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,var(--surface-raised))] text-[var(--warning-ink)]"
                : r.tone === "green"
                  ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,var(--surface-raised))] text-[var(--success-ink)]"
                  : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,var(--surface-raised))] text-[var(--accent-strong)]";
            return (
              <li
                key={r.title}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${palette}`}>
                  <FileText className="h-3 w-3" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {r.title}
                </span>
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                  {r.owner}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                  {r.due}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </MockShell>
  );
}

/**
 * Preview for §6 Collect evidence — request rows with status, owner, due date,
 * and the linked contract embedded in the label.
 */
export function EvidenceRequestPreview() {
  const rows = [
    { label: "SOC 2 report — Initech", status: "Received", owner: "MD", due: "Apr 8", tone: "green" as const },
    { label: "Insurance COI — Acme", status: "Requested", owner: "SO", due: "Apr 20", tone: "accent" as const },
    { label: "Renewal confirmation — Hooli", status: "Overdue", owner: "TK", due: "Apr 2", tone: "amber" as const },
  ];
  return (
    <MockShell
      caption="Evidence requests"
      tone="amber"
      chromePath="oblixa.com/contracts/evidence"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Evidence requests — 3 open
        </p>
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const statusPill =
              r.tone === "amber"
                ? "border-[color:color-mix(in_oklab,var(--warning-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_40%,var(--surface-raised))] text-[var(--warning-ink)]"
                : r.tone === "green"
                  ? "border-[color:color-mix(in_oklab,var(--success-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_40%,var(--surface-raised))] text-[var(--success-ink)]"
                  : "border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] text-[var(--accent-strong)]";
            return (
              <li
                key={r.label}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_oklab,var(--warning-soft)_60%,var(--surface-raised))] text-[var(--warning-ink)]">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {r.label}
                </span>
                <span className={`hidden shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] sm:inline-flex ${statusPill}`}>
                  {r.status}
                </span>
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                  {r.owner}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                  {r.due}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </MockShell>
  );
}

/**
 * v6 T9.7 — New preview for §7 Report and export.
 * Shows a CSV-style table with a CSV export button.
 */
export function ReportsExportPreview() {
  const rows = [
    { contract: "Acme — MSA", date: "Apr 12", owner: "SO" },
    { contract: "Initech — DPA", date: "May 20", owner: "MD" },
    { contract: "Hooli — SaaS", date: "Apr 15", owner: "TK" },
    { contract: "Globex — Lease", date: "Jun 02", owner: "SO" },
  ];
  return (
    <MockShell
      caption="Reports export"
      tone="success"
      chromePath="oblixa.com/reports/upcoming-renewals"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-[var(--success-ink)]" aria-hidden />
              Upcoming renewals — 4 of 12
            </span>
          </p>
          <span className="inline-flex items-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--success-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-ink)_8%,var(--surface-raised))] px-2.5 py-1 text-[11px] font-semibold text-[var(--success-ink)]">
            <Download className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
            CSV
          </span>
        </div>
        <ul className="space-y-1">
          <li className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-md bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <span>Contract</span>
            <span>Date</span>
            <span>Owner</span>
          </li>
          {rows.map((r) => (
            <li
              key={r.contract}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5"
            >
              <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                {r.contract}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {r.date}
              </span>
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                {r.owner}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </MockShell>
  );
}
