import { FileText, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface StatsCardsProps {
  totalContracts: number;
  pendingReview: number;
  upcomingDeadlines: number;
  activeContracts: number;
}

export function StatsCards({
  totalContracts,
  pendingReview,
  upcomingDeadlines,
  activeContracts,
}: StatsCardsProps) {
  const stats = [
    {
      name: "Total Contracts",
      value: totalContracts,
      icon: FileText,
      color: "text-gray-600 bg-gray-100",
    },
    {
      name: "Pending Review",
      value: pendingReview,
      icon: AlertCircle,
      color: "text-amber-600 bg-amber-100",
    },
    {
      name: "Upcoming Deadlines",
      value: upcomingDeadlines,
      icon: Clock,
      color: "text-red-600 bg-red-100",
    },
    {
      name: "Active Contracts",
      value: activeContracts,
      icon: CheckCircle,
      color: "text-green-600 bg-green-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="rounded-lg border border-gray-200 bg-white p-5"
        >
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
        </div>
      ))}
    </div>
  );
}
