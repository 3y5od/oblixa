import { BarChart3, Bell, Check, Download, FileText } from "lucide-react";

/**
 * Static product previews shown between sections on /product (T7/T9).
 *
 * v6 additions:
 * - Faux browser chrome (T2.8 pattern reused here for T9.4)
 * - Contextual caption: "What §X looks like in your trial" (T9.2)
 * - Leader-line annotations (T9.3) on key UI elements
 * - New ReportsExportPreview for §7 (T9.7)
 * - Tone-tinted chrome per section (T9.8)
 *
 * All mocks share an aspect-[16/9] container (T24.3) so the inter-section
 * rhythm stays consistent. Voice-rule safe — no banned phrases.
 */

type ToneName = "cool" | "warm" | "amber" | "success";

const TONE_TOKEN: Record<ToneName, string> = {
  cool: "var(--accent-strong)",
  warm: "var(--accent-warm, var(--accent))",
  amber: "var(--warning-ink)",
  success: "var(--success-ink)",
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
        className="relative overflow-hidden rounded-3xl border shadow-[var(--shadow-1)]"
        style={{
          borderColor: `color-mix(in oklab, ${TONE_TOKEN[tone]} 22%, var(--border-subtle))`,
          background: "color-mix(in oklab, var(--surface-raised) 92%, transparent)",
        }}
      >
        <BrowserChrome path={chromePath} />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 top-2 h-32 w-32 rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${TONE_TOKEN[tone]} 32%, transparent), transparent 70%)`,
          }}
        />
        {/* Height is content-driven — aspect-[16/9] forced empty space that read
            as obstructive and disproportionate to the (small) UI shown inside. */}
        <div className="relative w-full p-4 sm:p-5">
          {children}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-[var(--text-tertiary)]">
        <span className="text-[var(--text-secondary)]">{sectionRef}</span> in the trial workspace
      </figcaption>
    </figure>
  );
}

export function ReviewFieldsPreview() {
  return (
    <MockShell
      caption="Field review"
      sectionRef="§3 Review key terms"
      tone="warm"
      chromePath="oblixa.com/contracts/acme-msa/fields"
    >
      <div className="relative h-full rounded-xl border border-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            Renewal date
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--accent-strong)]">
            AI 96%
          </span>
        </div>
        <p className="mt-2 text-[16px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[20px]">
          March 12, 2027
        </p>
        <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          &ldquo;The Initial Term shall commence on{" "}
          <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
            March 12, 2024
          </span>{" "}
          and continue for three (3) years…&rdquo;
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-white">
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
      sectionRef="§4 Track dates"
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
                ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,white)] text-[var(--warning-ink)]"
                : r.tone === "green"
                  ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,white)] text-[var(--success-ink)]"
                  : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,white)] text-[var(--accent-strong)]";
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
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
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
      sectionRef="§5 Assign work"
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
                ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,white)] text-[var(--warning-ink)]"
                : r.tone === "green"
                  ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,white)] text-[var(--success-ink)]"
                  : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,white)] text-[var(--accent-strong)]";
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
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
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
 * Shows a CSV-style table with a Download CSV button.
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
      sectionRef="§7 Report and export"
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
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--success-ink)] px-2.5 py-1 text-[11px] font-semibold text-white">
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
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                {r.owner}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </MockShell>
  );
}
