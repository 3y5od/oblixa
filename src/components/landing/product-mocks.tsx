import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Slash,
  UserX,
} from "lucide-react";

/**
 * Static product previews paired with each section on /product.
 *
 * Each mock is a faux-browser-chrome card with a subtly tone-tinted border that
 * ties it to its section. Height is content-driven (no aspect-ratio padding),
 * and the surfaces stay calm — no decorative glow layers. Voice-rule safe.
 */

type ToneName = "cool" | "warm" | "amber" | "success" | "neutral";

const TONE_TOKEN: Record<ToneName, string> = {
  cool: "var(--accent-strong)",
  warm: "var(--accent-warm, var(--accent))",
  amber: "var(--warning-ink)",
  success: "var(--success-ink)",
  // Neutral frame — for previews (e.g. the dashboard overview) that should not
  // read as accent-tinted. Keeps accent reserved for real status + interaction.
  neutral: "var(--border-strong)",
};

/**
 * v7 T28.2 — removed the 3 colored macOS-window dots from the chrome bar.
 * Skeuomorphic, no purpose, competed with the URL for top-left attention.
 * v7 T27.9 — URL font-size 10.5px → 10px to reduce visual noise.
 */
function BrowserChrome({ path }: { path: string }) {
  return (
    <div className="product-browser-chrome">
      <span className="truncate font-mono text-[10px] text-[var(--text-tertiary)]">
        {path}
      </span>
    </div>
  );
}

function MockShell({
  caption,
  sectionRef,
  tone,
  chromePath,
  children,
}: {
  caption: string;
  /** v6 T9.2 — anchor reference so the caption can tie back ("What §3 looks like...") */
  sectionRef: string;
  tone: ToneName;
  chromePath: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      aria-label={`Product preview: ${caption}`}
      className="w-full"
    >
      <div
        className="relative overflow-hidden rounded-2xl border shadow-[var(--shadow-1)]"
        style={{
          borderColor: `color-mix(in oklab, ${TONE_TOKEN[tone]} 18%, var(--border-subtle))`,
          background: "var(--surface-raised)",
        }}
      >
        <BrowserChrome path={chromePath} />
        {/* Height is content-driven; no aspect-ratio padding (it forced empty
            space disproportionate to the small UI shown inside). */}
        <div className="relative w-full p-4 sm:p-5">
          {children}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-[var(--text-tertiary)]">
        <span className="text-[var(--text-secondary)]">{sectionRef}</span> — early-access preview
      </figcaption>
    </figure>
  );
}

/**
 * Lead preview for the /product hero — a Core "what needs attention" dashboard.
 *
 * Mirrors the real dashboard top-cards vocabulary (src/components/dashboard/
 * dashboard-upper.tsx): each KPI cell is a tone-anchored icon medallion next to
 * a tone-colored count (so the number never floats), with semantics matching the
 * app — exceptions + blocked work read as risk (danger); review, deadlines,
 * owners, evidence read as attention (warning). The contract table reuses the
 * app's .ui-table-header / .ui-table-row classes. Neutral frame — accent stays
 * reserved for real status + interaction.
 */
export function DashboardOverviewPreview() {
  const cells: Array<{
    label: string;
    value: number;
    tone: "warning" | "danger";
    Icon: typeof ClipboardCheck;
  }> = [
    { label: "Needs review", value: 4, tone: "warning", Icon: ClipboardCheck },
    { label: "Upcoming deadlines", value: 6, tone: "warning", Icon: CalendarClock },
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
    <MockShell
      caption="Contract dashboard"
      sectionRef="Dashboard"
      tone="neutral"
      chromePath="oblixa.com/dashboard"
    >
      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">What needs attention</p>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {cells.map((c) => {
          const i = ink(c.tone);
          const Icon = c.Icon;
          return (
            <div key={c.label} className="min-w-0">
              <p className="ui-caps-2 truncate text-[9px] text-[var(--text-tertiary)]">
                {c.label}
              </p>
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
      <div className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3.5">
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
              <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                {r.name}
              </span>
              {!r.reviewed ? (
                <span className="ml-0.5 inline-flex shrink-0 items-center rounded border border-[color:color-mix(in_oklab,var(--warning-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_40%,var(--surface-raised))] px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] leading-none text-[var(--warning-ink)]">
                  Review
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

export function ReviewFieldsPreview() {
  return (
    <MockShell
      caption="Field review"
      sectionRef="Review suggested fields"
      tone="warm"
      chromePath="oblixa.com/contracts/acme-msa/fields"
    >
      <div className="relative h-full rounded-xl border border-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            Renewal date
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--accent-strong)]">
            SOURCE MATCH 96%
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
    { name: "Acme renewal", days: "30d", owner: "SO", date: "Apr 12", tone: "accent" as const },
    { name: "Initech audit", days: "14d", owner: "MD", date: "May 20", tone: "amber" as const },
    { name: "Hooli notice", days: "60d", owner: "TK", date: "Apr 15", tone: "green" as const },
  ];
  return (
    <MockShell
      caption="Upcoming dates"
      sectionRef="Track dates"
      tone="warm"
      chromePath="oblixa.com/dashboard/upcoming"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Reminders this week
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
      sectionRef="Assign work"
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
      sectionRef="Collect evidence"
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
      sectionRef="Report and export"
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
