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
      name: "Total Contracts",
      value: totalContracts,
      icon: FileText,
      color: "text-gray-600 bg-gray-100",
      href: "/contracts" as const,
    },
    {
      name: "Pending Review",
      value: pendingReview,
      icon: AlertCircle,
      color: "text-amber-600 bg-amber-100",
      href: "/contracts?status=pending_review" as const,
    },
    {
      name: "Upcoming Deadlines",
      value: upcomingDeadlines,
      icon: Clock,
      color: "text-red-600 bg-red-100",
      href: "/contracts" as const,
    },
    {
      name: "Active Contracts",
      value: activeContracts,
      icon: CheckCircle,
      color: "text-green-600 bg-green-100",
      href: "/contracts?status=active" as const,
    },
    {
      name: "Missing key dates",
      value: missingCriticalCount,
      icon: AlertTriangle,
      color: "text-orange-600 bg-orange-50",
      href: "#missing-critical" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => {
        const inner = (
          <>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">
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
              className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-orange-200 hover:bg-orange-50/30"
            >
              {inner}
            </a>
          );
        }
        return (
          <Link
            key={stat.name}
            href={stat.href}
            className="rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
