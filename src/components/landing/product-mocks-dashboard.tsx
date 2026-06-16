import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  Slash,
  UserX,
} from "lucide-react";
import {
  OwnerAvatar,
  PreviewFoot,
  PreviewShell,
} from "@/components/landing/landing-preview-shared";

/**
 * Hero artifact for /product — the dashboard "what needs action" surface.
 * This is the page's PRIMARY artifact, so it carries the densest content
 * (six object-typed counts + a recent-contracts ledger). Every count names
 * the object class it represents (release-state §Count Semantics): the reader
 * never has to infer whether a number is contracts, tasks, dates, or requests.
 */
export function DashboardOverviewPreview() {
  const cells: Array<{
    label: string;
    value: number;
    tone: "warning" | "danger";
    Icon: typeof ClipboardCheck;
  }> = [
    { label: "Contracts needing review", value: 4, tone: "warning", Icon: ClipboardCheck },
    { label: "Renewal and notice dates", value: 6, tone: "warning", Icon: CalendarClock },
    { label: "Tasks that cannot proceed", value: 2, tone: "danger", Icon: Slash },
    { label: "Contracts missing an owner", value: 2, tone: "warning", Icon: UserX },
    { label: "Open problems", value: 1, tone: "danger", Icon: AlertTriangle },
    { label: "Evidence requests open", value: 3, tone: "warning", Icon: ShieldAlert },
  ];
  const ink = (t: "warning" | "danger") =>
    t === "danger" ? "var(--danger-ink)" : "var(--warning-ink)";
  const rows: Array<{ name: string; owner: string; date: string; reviewed: boolean }> = [
    { name: "Northstar Services MSA", owner: "PR", date: "Mar 12", reviewed: true },
    { name: "Brightline Vendor Agreement", owner: "MD", date: "Apr 02", reviewed: false },
    { name: "Summit Office Lease", owner: "TK", date: "Jun 02", reviewed: true },
  ];
  return (
    <PreviewShell
      variant="ledger"
      breadcrumb={["Northstar workspace", "Dashboard"]}
      title="Contract tracking"
      footer={
        <PreviewFoot
          icon={FileText}
          label="Each count opens the contracts it represents"
          meta="Northstar workspace"
        />
      }
    >
      <div className="p-4 sm:p-5">
        <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">What needs action</p>
        <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-3">
          {cells.map((c) => {
            const i = ink(c.tone);
            const Icon = c.Icon;
            return (
              <div key={c.label} className="min-w-0">
                <p className="ui-caps-2 text-[9px] leading-[1.3] text-[var(--text-tertiary)]">
                  {c.label}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border"
                    style={{
                      borderColor: `color-mix(in oklab, ${i} 28%, var(--border-card))`,
                      background: `color-mix(in oklab, ${i} 12%, var(--surface))`,
                      color: i,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                  </span>
                  <span
                    className="text-[1.375rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                    style={{ color: i }}
                  >
                    {c.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-3.5 sm:px-5">
        <p className="ui-caps-2 mb-2 text-[10px] text-[var(--text-tertiary)]">
          Recent contracts — 3 of 24
        </p>
        <div className="ui-table-header grid grid-cols-[minmax(0,1fr)_auto_3.25rem] items-center gap-x-3 rounded-[3px] px-2.5 py-1.5 text-[9.5px]">
          <span>Contract</span>
          <span className="justify-self-center">Owner</span>
          <span className="justify-self-end">Renewal</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="ui-table-row grid grid-cols-[minmax(0,1fr)_auto_3.25rem] items-center gap-x-3 px-2.5 py-2 [&:last-child]:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: r.reviewed ? "var(--success-ink)" : "var(--warning-ink)",
                  boxShadow: `0 0 0 2.5px color-mix(in oklab, ${r.reviewed ? "var(--success-soft)" : "var(--warning-soft)"} 45%, transparent)`,
                }}
              />
              <span className="sr-only">
                {r.reviewed ? "Reviewed" : "Needs detail confirmation"}
              </span>
              <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                {r.name}
              </span>
              {!r.reviewed ? (
                <span className="ml-0.5 inline-flex shrink-0 items-center rounded-[2px] border border-[color:color-mix(in_oklab,var(--warning-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_40%,var(--surface-raised))] px-1 py-0.5 text-[8px] font-bold uppercase leading-none tracking-[0.1em] text-[var(--warning-ink)]">
                  Needs confirmation
                </span>
              ) : null}
            </span>
            <span className="justify-self-center">
              <OwnerAvatar initials={r.owner} />
            </span>
            <span className="justify-self-end font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
              {r.date}
            </span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}
