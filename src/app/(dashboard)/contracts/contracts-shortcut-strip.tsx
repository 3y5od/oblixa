import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Hourglass,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { ContractsPageModel } from "./contracts-page-model";

type ShortcutGroupKey = "attention" | "review" | "active";

type Shortcut = {
  count: number;
  href: string;
  tone: "danger" | "warning" | "info" | "success";
  Icon: LucideIcon;
  label: string;
  def: string;
  name: (n: number) => string;
  group: ShortcutGroupKey;
};

// Two register bands. Critical trust/condition lenses (problems, missing dates,
// evidence due, details to confirm) read as toned condition chips because they
// gate the record. Routine portfolio counts (open tasks, upcoming renewals,
// active) read as quiet inline count links — not a second wall of chips and not
// cobalt — so the strip reads as a ledger index rather than a busy chip row
// (§16 reserve chips for critical states, §6 quieter chrome, cobalt = actions).
const SHORTCUT_GROUPS: { key: ShortcutGroupKey; label: string }[] = [
  { key: "attention", label: "Needs attention" },
  { key: "review", label: "Review state" },
];

function ConditionChip({ count, href, tone, Icon, label, def, name }: Shortcut) {
  return (
    <Link
      href={href}
      className={`ui-quick-chip ui-quick-chip-tone-${tone} group relative`}
      // The definition is the accessible name's tail so screen-reader users get it
      // without the (aria-hidden) visual tooltip.
      aria-label={`${name(count)}. ${def}`}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {label}
      <span className="ui-quick-chip-count">{count}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(100%+7px)] left-0 z-30 w-max max-w-[16rem] rounded-md bg-[var(--text-primary)] px-2.5 py-1.5 text-[11px] font-normal leading-snug text-[var(--surface)] opacity-0 shadow-[var(--shadow-2)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {def}
        <span className="absolute left-3 top-full h-2 w-2 -translate-y-1/2 rotate-45 bg-[var(--text-primary)]" />
      </span>
    </Link>
  );
}

// Routine portfolio lenses: a quiet count link, the count carried inline as a
// tabular figure with a faint divider into its label. No box, no cobalt — the
// hover/focus underline is the only affordance.
function PortfolioCountLink({ count, href, label, def, name }: Shortcut) {
  return (
    <Link
      href={href}
      aria-label={`${name(count)}. ${def}`}
      className="group inline-flex items-baseline gap-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:text-[var(--text-primary)]"
    >
      <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
        {count}
      </span>
      <span className="underline-offset-2 group-hover:underline group-focus-visible:underline">{label}</span>
    </Link>
  );
}

export function ContractsShortcutStrip({ model }: { model: ContractsPageModel }) {
  if (!model.shouldShowShortcutStrip) return null;
  const shortcutCounts = model.shortcutCounts;
  const shortcuts: Shortcut[] = [
    {
      count: shortcutCounts.openProblems,
      href: "/contracts?exceptions=open",
      tone: "danger",
      Icon: AlertTriangle,
      label: "Open problems",
      def: "Unresolved problems linked to the contract.",
      name: (n) => `${n} ${n === 1 ? "contract" : "contracts"} with open problems`,
      group: "attention",
    },
    {
      count: shortcutCounts.missingDates,
      href: "/contracts?data_quality=missing_critical",
      tone: "warning",
      Icon: CalendarDays,
      label: "Missing dates",
      def: "Required renewal, notice, end, or effective dates are absent.",
      name: (n) => `${n} ${n === 1 ? "contract" : "contracts"} missing dates`,
      group: "attention",
    },
    {
      count: shortcutCounts.evidenceDue,
      href: "/contracts?evidence=outstanding",
      tone: "warning",
      Icon: ClipboardCheck,
      label: "Evidence due",
      def: "An open evidence request is linked to the contract.",
      name: (n) => `${n} ${n === 1 ? "contract" : "contracts"} with evidence due`,
      group: "attention",
    },
    {
      count: shortcutCounts.detailsToReview,
      href: "/contracts?review=pending",
      tone: "warning",
      Icon: Hourglass,
      label: "Needs confirmation",
      def: "Suggested dates, owners, or terms awaiting confirmation.",
      name: (n) => `${n} ${n === 1 ? "contract" : "contracts"} needing detail review`,
      group: "review",
    },
    {
      count: shortcutCounts.openTasks,
      href: "/contracts?work=open",
      tone: "info",
      Icon: ListChecks,
      label: "open tasks",
      def: "Active follow-up tasks are linked to the contract.",
      name: (n) => `${n} ${n === 1 ? "contract" : "contracts"} with open tasks`,
      group: "active",
    },
    {
      count: shortcutCounts.renewalWithin90Days,
      href: "/contracts?deadline=renewal_90",
      tone: "info",
      Icon: CalendarClock,
      label: "renewing within 90 days",
      def: "Renewal date falls inside the next 90 days.",
      name: (n) => `${n} ${n === 1 ? "contract" : "contracts"} renewing within 90 days`,
      group: "active",
    },
    {
      count: shortcutCounts.active,
      href: "/contracts?status=active",
      tone: "success",
      Icon: CircleCheck,
      label: "active",
      def: "Contract status is active.",
      name: (n) => `${n} active ${n === 1 ? "contract" : "contracts"}`,
      group: "active",
    },
  ];

  const conditionGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    chips: shortcuts.filter((shortcut) => shortcut.group === group.key && shortcut.count > 0),
  })).filter((group) => group.chips.length > 0);
  const portfolioLinks = shortcuts.filter((shortcut) => shortcut.group === "active" && shortcut.count > 0);

  return (
    <nav
      aria-label="Contract condition filters"
      className="min-w-0 space-y-2.5 border-b border-[color:color-mix(in_oklab,var(--border-strong)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-inset)_28%,var(--surface-raised))] px-4 py-3"
    >
      <div className="min-w-0">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-primary)]">
          Contract condition filters
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
          Each count is the number of matching contracts — select a condition to filter the list.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2.5">
        {conditionGroups.map((group, index) => (
          <div key={group.key} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            {index > 0 ? (
              <span aria-hidden className="hidden h-5 w-px shrink-0 bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)] sm:block" />
            ) : null}
            {/* Stronger band label: ink-toned and weighted so the lenses read as
                group headers, not a row of quiet chips. */}
            <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              {group.label}
            </span>
            {group.chips.map((shortcut) => (
              <ConditionChip key={shortcut.href} {...shortcut} />
            ))}
          </div>
        ))}
        {portfolioLinks.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
            {conditionGroups.length > 0 ? (
              <span aria-hidden className="hidden h-5 w-px shrink-0 bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)] sm:block" />
            ) : null}
            <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              In portfolio
            </span>
            {portfolioLinks.map((shortcut) => (
              <PortfolioCountLink key={shortcut.href} {...shortcut} />
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
