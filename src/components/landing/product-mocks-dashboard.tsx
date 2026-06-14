import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ShieldAlert,
  Slash,
  UserX,
} from "lucide-react";
import { MockShell } from "@/components/landing/product-mock-shell";

export function DashboardOverviewPreview() {
  const cells: Array<{
    label: string;
    value: number;
    tone: "warning" | "danger";
    Icon: typeof ClipboardCheck;
  }> = [
    { label: "Needs review", value: 4, tone: "warning", Icon: ClipboardCheck },
    { label: "Upcoming deadlines", value: 6, tone: "danger", Icon: CalendarClock },
    { label: "Blocked work", value: 2, tone: "danger", Icon: Slash },
    { label: "Missing owners", value: 2, tone: "warning", Icon: UserX },
    { label: "Open exceptions", value: 1, tone: "danger", Icon: AlertTriangle },
    { label: "Evidence requested", value: 3, tone: "warning", Icon: ShieldAlert },
  ];
  const ink = (t: "warning" | "danger") =>
    t === "danger" ? "var(--danger-ink)" : "var(--warning-ink)";
  const rows: Array<{ name: string; owner: string; date: string; reviewed: boolean }> = [
    { name: "Acme — MSA", owner: "SO", date: "Apr 12", reviewed: true },
    { name: "Initech — DPA", owner: "MD", date: "May 20", reviewed: false },
    { name: "Hooli — Lease", owner: "TK", date: "Jun 02", reviewed: true },
  ];
  return (
    <MockShell caption="Dashboard" tone="neutral" chromePath="oblixa.com/dashboard">
      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">What needs action</p>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {cells.map((c) => {
          const i = ink(c.tone);
          const Icon = c.Icon;
          return (
            <div key={c.label} className="min-w-0">
              <p className="ui-caps-2 truncate text-[9px] text-[var(--text-tertiary)]">{c.label}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                  style={{
                    borderColor: `color-mix(in oklab, ${i} 28%, var(--border-card))`,
                    background: `color-mix(in oklab, ${i} 12%, var(--surface))`,
                    color: i,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                </span>
                <span className="text-[1.375rem] font-semibold leading-none tabular-nums tracking-[-0.02em]" style={{ color: i }}>
                  {c.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3.5">
        <p className="ui-caps-2 mb-2 text-[10px] text-[var(--text-tertiary)]">Recent contracts — 3 of 24</p>
        <div className="ui-table-header grid grid-cols-[minmax(0,1fr)_auto_3.25rem] items-center gap-x-3 rounded-md px-2.5 py-1.5 text-[9.5px]">
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
              <span className="sr-only">{r.reviewed ? "Reviewed" : "Needs field review"}</span>
              <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">{r.name}</span>
              {!r.reviewed ? (
                <span className="ml-0.5 inline-flex shrink-0 items-center rounded border border-[color:color-mix(in_oklab,var(--warning-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_40%,var(--surface-raised))] px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] leading-none text-[var(--warning-ink)]">
                  Needs review
                </span>
              ) : null}
            </span>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center justify-self-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
              {r.owner}
            </span>
            <span className="justify-self-end font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
              {r.date}
            </span>
          </div>
        ))}
      </div>
    </MockShell>
  );
}
