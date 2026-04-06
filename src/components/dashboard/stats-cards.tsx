import Link from "next/link";

interface StatsCardsProps {
  totalContracts: number;
  pendingReview: number;
  upcomingDeadlines: number;
  activeContracts: number;
  missingCriticalCount: number;
}

/** Short uppercase labels — keep single line at typical column widths; detail in `name` below. */
const metricsConfig = [
  {
    name: "Portfolio",
    sub: "Contracts",
    valueKey: "totalContracts" as const,
    href: "/contracts" as const,
  },
  {
    name: "Review",
    sub: "Pending",
    valueKey: "pendingReview" as const,
    href: "/contracts?status=pending_review" as const,
  },
  {
    name: "Horizon",
    sub: "≤30 days",
    valueKey: "upcomingDeadlines" as const,
    href: "/contracts" as const,
  },
  {
    name: "Active",
    sub: "In force",
    valueKey: "activeContracts" as const,
    href: "/contracts?status=active" as const,
  },
  {
    name: "Gaps",
    sub: "Key dates",
    valueKey: "missingCriticalCount" as const,
    href: "#missing-critical" as const,
  },
] as const;

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

  const toneFor = (
    key: (typeof metricsConfig)[number]["valueKey"],
    value: number
  ): "default" | "urgent" | "attention" | "warning" => {
    if (key === "upcomingDeadlines" && value > 0) return "urgent";
    if (key === "pendingReview" && value > 0) return "attention";
    if (key === "missingCriticalCount" && value > 0) return "warning";
    return "default";
  };

  const valueClass = (tone: ReturnType<typeof toneFor>) => {
    switch (tone) {
      case "urgent":
        return "text-rose-700";
      case "attention":
        return "text-amber-800";
      case "warning":
        return "text-orange-800";
      default:
        return "text-zinc-950";
    }
  };

  const cellClass =
    "ui-transition-surface flex h-full min-h-[7.5rem] flex-col px-5 py-6 hover:bg-zinc-50/80 sm:min-h-0 sm:px-6";

  return (
    <div className="ui-card ui-card-hover overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100/80 lg:grid-cols-5">
        {metricsConfig.map((m) => {
          const value = values[m.valueKey];
          const tone = toneFor(m.valueKey, value);
          const inner = (
            <>
              {/* Fixed-height label band so values align across columns when labels wrap on small screens */}
              <div className="flex min-h-[2.5rem] items-start">
                <p className="ui-metric-label line-clamp-2 leading-snug">{m.sub}</p>
              </div>
              <p
                className={`ui-metric-value mt-3 tabular-nums ${valueClass(tone)}`}
              >
                {value}
              </p>
              <p className="mt-2 text-[12px] font-medium leading-tight text-zinc-400">
                {m.name}
              </p>
            </>
          );
          const label = `${m.name}: ${value}`;
          if (m.href === "#missing-critical") {
            return (
              <a
                key={m.name}
                href={m.href}
                aria-label={label}
                className={cellClass}
              >
                {inner}
              </a>
            );
          }
          return (
            <Link
              key={m.name}
              href={m.href}
              aria-label={label}
              className={cellClass}
            >
              {inner}
            </Link>
          );
        })}
      </div>
      <p className="border-t border-zinc-100/80 bg-zinc-50/30 px-5 py-3.5 text-center text-[11px] leading-relaxed text-zinc-400 sm:px-6">
        Snapshot of your workspace — click a metric to filter
      </p>
    </div>
  );
}
