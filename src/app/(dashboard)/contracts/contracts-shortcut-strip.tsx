import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Hourglass,
  ListChecks,
} from "lucide-react";
import type { ContractsPageModel } from "./contracts-page-model";

export function ContractsShortcutStrip({ model }: { model: ContractsPageModel }) {
  if (!model.shouldShowShortcutStrip) return null;
  const shortcutCounts = model.shortcutCounts;
  const shortcuts = [
    {
      count: shortcutCounts.openProblems,
      href: "/contracts?exceptions=open",
      tone: "danger",
      Icon: AlertTriangle,
      label: "Open problems",
      name: (n: number) => `${n} ${n === 1 ? "contract" : "contracts"} with open problems`,
    },
    {
      count: shortcutCounts.detailsToReview,
      href: "/contracts?review=pending",
      tone: "warning",
      Icon: Hourglass,
      label: "Details to review",
      name: (n: number) => `${n} ${n === 1 ? "contract" : "contracts"} needing detail review`,
    },
    {
      count: shortcutCounts.missingDates,
      href: "/contracts?data_quality=missing_critical",
      tone: "warning",
      Icon: CalendarDays,
      label: "Missing dates",
      name: (n: number) => `${n} ${n === 1 ? "contract" : "contracts"} missing dates`,
    },
    {
      count: shortcutCounts.evidenceDue,
      href: "/contracts?evidence=outstanding",
      tone: "warning",
      Icon: ClipboardCheck,
      label: "Evidence due",
      name: (n: number) => `${n} ${n === 1 ? "contract" : "contracts"} with evidence due`,
    },
    {
      count: shortcutCounts.openTasks,
      href: "/contracts?work=open",
      tone: "info",
      Icon: ListChecks,
      label: "Open tasks",
      name: (n: number) => `${n} ${n === 1 ? "contract" : "contracts"} with open tasks`,
    },
    {
      count: shortcutCounts.renewalWithin90Days,
      href: "/contracts?deadline=renewal_90",
      tone: "info",
      Icon: CalendarClock,
      label: "Renewal within 90 days",
      name: (n: number) => `${n} ${n === 1 ? "contract" : "contracts"} renewing within 90 days`,
    },
    {
      count: shortcutCounts.active,
      href: "/contracts?status=active",
      tone: "success",
      Icon: CircleCheck,
      label: "Active",
      name: (n: number) => `${n} active ${n === 1 ? "contract" : "contracts"}`,
    },
  ];

  return (
    <nav
      aria-label="Contract condition filters"
      className="min-w-0 space-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-3"
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="ui-caps-3 inline-flex items-center text-[10px] text-[var(--text-tertiary)]">
          Contract condition filters
        </p>
        <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
          Each count is a contract count. Selecting a condition filters the contract inventory.
        </p>
      </div>
      <dl className="grid min-w-0 gap-x-8 gap-y-1.5 text-[11px] leading-snug sm:grid-cols-2">
        {[
          ["Open problems", "Unresolved problems linked to the contract."],
          ["Details to review", "Suggested dates, owners, or terms awaiting confirmation."],
          ["Missing dates", "Required renewal, notice, end, or effective dates are absent."],
          ["Evidence due", "An open evidence request is linked to the contract."],
          ["Open tasks", "Active follow-up tasks are linked to the contract."],
          ["Renewal within 90 days", "Renewal date falls inside the next 90 days."],
          ["Active", "Contract status is active."],
        ].map(([term, meaning]) => (
          <div key={term} className="flex min-w-0 items-baseline gap-1.5">
            <dt className="shrink-0 font-semibold text-[var(--text-secondary)]">{term}</dt>
            <dd className="min-w-0 text-[var(--text-tertiary)]">{meaning}</dd>
          </div>
        ))}
      </dl>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {shortcuts
          .filter((c) => c.count > 0)
          .map(({ count, href, tone, Icon, label, name }) => (
            <Link
              key={href}
              href={href}
              className={`ui-quick-chip ui-quick-chip-tone-${tone}`}
              aria-label={name(count)}
              title={name(count)}
            >
              <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              {label}
              <span className="ui-quick-chip-count">{count}</span>
            </Link>
          ))}
      </div>
    </nav>
  );
}
