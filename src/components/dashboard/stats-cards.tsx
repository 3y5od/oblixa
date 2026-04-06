import { FileText, AlertCircle, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface StatsCardsProps {
  totalContracts: number;
  pendingReview: number;
  upcomingDeadlines: number;
  activeContracts: number;
  missingCriticalCount: number;
}

export function StatsCards({
  totalContracts,
  pendingReview,
  upcomingDeadlines,
  activeContracts,
  missingCriticalCount,
}: StatsCardsProps) {
  const stats = [
    {
      name: "Total contracts",
      value: totalContracts,
      icon: FileText,
      iconWrap: "border-zinc-200/90 bg-zinc-50 text-zinc-600",
      href: "/contracts" as const,
    },
    {
      name: "Pending review",
      value: pendingReview,
      icon: AlertCircle,
      iconWrap: "border-amber-200/70 bg-amber-50/80 text-amber-800",
      href: "/contracts?status=pending_review" as const,
    },
    {
      name: "Upcoming deadlines",
      value: upcomingDeadlines,
      icon: Clock,
      iconWrap: "border-rose-200/70 bg-rose-50/80 text-rose-800",
      href: "/contracts" as const,
    },
    {
      name: "Active contracts",
      value: activeContracts,
      icon: CheckCircle,
      iconWrap: "border-emerald-200/70 bg-emerald-50/80 text-emerald-800",
      href: "/contracts?status=active" as const,
    },
    {
      name: "Missing key dates",
      value: missingCriticalCount,
      icon: AlertTriangle,
      iconWrap: "border-orange-200/70 bg-orange-50/70 text-orange-900",
      href: "#missing-critical" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => {
        const inner = (
          <>
            <div className="flex items-center gap-3">
              <div
                className={`flex rounded-lg border p-2.5 ${stat.iconWrap}`}
              >
                <stat.icon size={18} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">{stat.name}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
                  {stat.value}
                </p>
              </div>
            </div>
          </>
        );
        if (stat.href === "#missing-critical") {
          return (
            <a
              key={stat.name}
              href={stat.href}
              className="ui-card block p-5 transition-[border-color,background-color] hover:border-orange-200/80 hover:bg-orange-50/20"
            >
              {inner}
            </a>
          );
        }
        return (
          <Link
            key={stat.name}
            href={stat.href}
            className="ui-card block p-5 transition-[border-color,background-color] hover:border-zinc-300/90 hover:bg-zinc-50/40"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
