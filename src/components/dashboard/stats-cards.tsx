import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  TriangleAlert,
} from "lucide-react";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import { surfaceTestIds } from "@/lib/qa/test-ids";

interface StatsCardsProps {
  totalContracts: number;
  pendingReview: number;
  upcomingDeadlines: number;
  activeContracts: number;
  missingCriticalCount: number;
}

const metricsConfig = [
  {
    headline: "Contracts",
    eyebrow: "Portfolio",
    valueKey: "totalContracts" as const,
    primaryUnit: "total records",
    href: "/contracts" as const,
    actionLabel: "View contracts",
    icon: FileText,
  },
  {
    headline: "Review",
    eyebrow: "Inbox",
    valueKey: "pendingReview" as const,
    primaryUnit: "pending review",
    href: "/contracts?status=pending_review" as const,
    actionLabel: "View review queue",
    icon: Eye,
  },
  {
    headline: "Deadlines",
    eyebrow: "Horizon",
    valueKey: "upcomingDeadlines" as const,
    primaryUnit: "due within 30d",
    href: "/contracts/review-cadence" as const,
    actionLabel: "View deadlines",
    icon: CalendarDays,
  },
  {
    headline: "Active",
    eyebrow: "Live",
    valueKey: "activeContracts" as const,
    primaryUnit: "active agreements",
    href: "/contracts?status=active" as const,
    actionLabel: "View active",
    icon: CheckCircle2,
  },
  {
    headline: "Data gaps",
    eyebrow: "Quality",
    valueKey: "missingCriticalCount" as const,
    primaryUnit: "critical fields missing",
    href: "/contracts/data-quality" as const,
    actionLabel: "View gaps",
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
  if (key === "totalContracts" || key === "activeContracts") return "neutral";
  return "healthy";
}

export function StatsCards({
  totalContracts,
  pendingReview,
  upcomingDeadlines,
  activeContracts,
  missingCriticalCount,
}: StatsCardsProps) {
  const values = {
    totalContracts,
    pendingReview,
    upcomingDeadlines,
    activeContracts,
    missingCriticalCount,
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-eyebrow">Portfolio</p>
          <h2 className="ui-page-title mt-2 text-[1.85rem]">Contract metrics</h2>
          <p className="ui-page-lead mt-2">Portfolio volume, review pressure, deadline horizon, and data risk at a glance.</p>
        </div>
      </div>
      <div
        data-testid={surfaceTestIds.dashboardStats}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-10"
      >
        {metricsConfig.map((m) => {
          const value = values[m.valueKey];
          const tone = toneFor(m.valueKey, value);
          const actionHref = m.href;
          return (
            <OperationalSummaryCard
              key={m.headline}
              variant="compact"
              className="lg:col-span-1 2xl:col-span-2"
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
