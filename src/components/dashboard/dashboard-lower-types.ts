import type { ActivityFeedItem } from "@/components/ui/activity-feed";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { Contract } from "@/lib/types";

export type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export type DashboardLowerTask = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export type DashboardLowerObligation = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "waived";
  due_date: string | null;
  obligation_type: string;
  contracts: { id: string; title: string; organization_id: string };
};

export type DashboardLowerUpcomingAction = {
  contract: { id: string; title: string; organization_id: string };
  field: { id: string; field_name: string; field_value: string | null };
  daysUntil: number;
};

export type DashboardLowerSectionsModel = {
  missingCritical: Contract[];
  promoteMissingBanner: boolean;
  reviewQueueContracts: Contract[];
  recentReviewStats: Record<string, ContractReviewStats>;
  upcomingActions: DashboardLowerUpcomingAction[];
  myTasks: DashboardLowerTask[];
  myObligations: DashboardLowerObligation[];
  dataGapsContracts: Contract[];
  activityItems: ActivityFeedItem[];
  activityContracts: Contract[];
};
