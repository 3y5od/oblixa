import {
  CalendarDays,
  Eye,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import { surfaceTestIds } from "@/lib/qa/test-ids";

interface StatsCardsProps {
  totalContracts: number;
  pendingReview: number;
  upcomingDeadlines: number;
  missingCriticalCount: number;
}

const metricsConfig = [
  {
    headline: "Review",
    eyebrow: "Inbox",
    valueKey: "pendingReview" as const,
    primaryUnit: "pending review",
    href: "/contracts?status=pending_review" as const,
    actionLabel: "Resume review",
    icon: Eye,
  },
  {
    headline: "Deadlines",
    eyebrow: "Horizon",
    valueKey: "upcomingDeadlines" as const,
    primaryUnit: "due within 30d",
    href: "/contracts/review-cadence" as const,
    actionLabel: "Review deadlines",
    icon: CalendarDays,
  },
  {
    headline: "Data gaps",
    eyebrow: "Quality",
    valueKey: "missingCriticalCount" as const,
    primaryUnit: "critical fields missing",
    href: "/contracts/data-quality" as const,
    actionLabel: "Review gaps",
    icon: TriangleAlert,
  },
] as const;

function toneFor(
  key: (typeof metricsConfig)[number]["valueKey"],
  value: number
): OperationalTone {
  if (key === "upcomingDeadlines" && value > 0) return "risk";
  if (key === "pendingReview" && value > 0) return "attention";
  if (key === "missingCriticalCount" && value > 0) return "risk";
  return "healthy";
}

export function StatsCards({
  totalContracts,
  pendingReview,
  upcomingDeadlines,
  missingCriticalCount,
}: StatsCardsProps) {
  const values = {
    pendingReview,
    upcomingDeadlines,
    missingCriticalCount,
  };
  const activeSignalCards = metricsConfig.filter((metric) => {
    const value = values[metric.valueKey];
    return value > 0;
  });

  if (totalContracts === 0) {
    return (
      <section className="ui-page-shell">
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Contracts
        </p>
        <h2 className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)]">Start with a contract</h2>
        <p className="ui-section-lead mt-2 max-w-3xl">
          Dashboard metrics appear after the workspace has contracts, review work, deadlines, or data-quality signals.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/contracts/new" className="ui-btn-primary px-4 py-2 text-xs">
            Upload contract
          </Link>
          <Link href="/contracts" className="ui-btn-secondary px-4 py-2 text-xs">
            Browse contracts
          </Link>
        </div>
      </section>
    );
  }

  if (activeSignalCards.length === 0) {
    return (
      <section className="ui-page-shell">
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Contracts
        </p>
        <h2 className="ui-section-title mt-1">No review, deadline, or data-quality signals need attention.</h2>
        <p className="ui-support-copy mt-2">
          {totalContracts} contract{totalContracts === 1 ? "" : "s"} visible in this workspace.
        </p>
        <Link href="/contracts" className="ui-link mt-3 inline-block text-xs">
          Browse contracts
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Contracts
        </p>
          <h2 className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)]">Signals to watch</h2>
          <p className="ui-page-lead mt-2">Only active review, deadline, and data-quality signals are expanded here.</p>
        </div>
      </div>
      <div
        data-testid={surfaceTestIds.dashboardStats}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {activeSignalCards.map((m) => {
          const value = values[m.valueKey];
          const tone = toneFor(m.valueKey, value);
          const actionHref = m.href;
          return (
            <OperationalSummaryCard
              key={m.headline}
              variant="compact"
              eyebrow={m.eyebrow}
              headline={m.headline}
              tone={tone}
              icon={m.icon}
              primaryValue={value}
              primaryUnit={m.primaryUnit}
              action={{
                href: actionHref,
                label: m.actionLabel,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
