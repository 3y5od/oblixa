import { differenceInDays, isValid } from "date-fns";
import { BadgeCheck, FileText, UploadCloud } from "lucide-react";
import type { ActivityFeedItem } from "@/components/ui/activity-feed";
import { DashboardLowerSections } from "@/components/dashboard/dashboard-lower-sections";
import { CONTRACT_LIST_ROW_COLUMNS } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import { attachOwnerProfiles } from "@/lib/contracts";
import {
  getDashboardAdminClientCached,
  getDashboardDateFieldsCached,
  getDashboardMissingCriticalCached,
} from "@/lib/dashboard-data";
import type { WorkspaceRole } from "@/lib/navigation";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import type { Contract } from "@/lib/types";
import type {
  DashboardDeadlineField,
  DashboardLowerObligation,
  DashboardLowerSectionsModel,
  DashboardLowerTask,
  DashboardLowerUpcomingAction,
} from "./dashboard-lower-types";

export async function DashboardLower(props: {
  orgId: string;
  userId: string;
  role: WorkspaceRole;
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
  productSurfaceContext: ProductSurfaceContext;
}) {
  const { orgId, userId } = props;
  const admin = await getDashboardAdminClientCached();
  const [
    missingCritical,
    dateFieldsData,
    { data: myTasksData },
    { data: myObligationsData },
    { data: recentContractsData },
    { data: tickerAuditRaw },
  ] = await Promise.all([
    getDashboardMissingCriticalCached(orgId),
    getDashboardDateFieldsCached(orgId),
    admin
      .from("contract_tasks")
      .select("id, title, status, priority, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("assignee_id", userId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    admin
      .from("contract_obligations")
      .select("id, title, status, due_date, obligation_type, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("owner_id", userId)
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    admin
      .from("contracts")
      .select(CONTRACT_LIST_ROW_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("audit_events")
      .select("id, action, user_id, contract_id, created_at, details")
      .eq("organization_id", orgId)
      .in("action", ["contract.uploaded", "extraction.completed", "field.approved"])
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const recentContracts = await attachOwnerProfiles(admin, orgId, recentContractsData ?? []);
  const recentContractsForView = recentContracts as Contract[];
  const recentReviewStats = await getReviewStatsForContractIds(
    admin,
    recentContracts.map((contract) => contract.id)
  );
  const reviewQueueContracts = recentContractsForView.filter((contract) => {
    const stats = recentReviewStats[contract.id];
    return (stats?.pending ?? 0) > 0 || contract.status === "pending_review";
  });
  const myTasks = buildDashboardLowerTasks(myTasksData ?? []);
  const myObligations = buildDashboardLowerObligations(myObligationsData ?? []);
  const upcomingActions = buildUpcomingActions(dateFieldsData as unknown as DashboardDeadlineField[]);
  const promoteMissingBanner =
    missingCritical.length >= 3 || upcomingActions.some((action) => action.daysUntil <= 7);
  const reviewIds = new Set(reviewQueueContracts.map((contract) => contract.id));
  const dataGapsContracts = promoteMissingBanner
    ? []
    : missingCritical.filter((contract) => !reviewIds.has(contract.id));
  const activityContracts = recentContractsForView.filter((contract) => !reviewIds.has(contract.id));
  const activityItems = buildActivityItems({
    tickerAuditRaw,
    recentContracts: recentContractsForView,
    recentReviewStats,
  });
  const model: DashboardLowerSectionsModel = {
    missingCritical: missingCritical as Contract[],
    promoteMissingBanner,
    reviewQueueContracts: reviewQueueContracts as Contract[],
    recentReviewStats,
    upcomingActions,
    myTasks,
    myObligations,
    dataGapsContracts: dataGapsContracts as Contract[],
    activityItems,
    activityContracts: activityContracts as Contract[],
  };

  return <DashboardLowerSections model={model} />;
}

function buildDashboardLowerTasks(rows: unknown[]): DashboardLowerTask[] {
  return rows.flatMap((row) => {
    const source = row as Record<string, unknown>;
    const contract = relationContract(source.contracts);
    if (!contract) return [];
    return [
      {
        id: String(source.id),
        title: String(source.title),
        status: source.status as DashboardLowerTask["status"],
        priority: source.priority as DashboardLowerTask["priority"],
        due_date: source.due_date as string | null,
        contracts: contract,
      },
    ];
  });
}

function buildDashboardLowerObligations(rows: unknown[]): DashboardLowerObligation[] {
  return rows.flatMap((row) => {
    const source = row as Record<string, unknown>;
    const contract = relationContract(source.contracts);
    if (!contract) return [];
    return [
      {
        id: String(source.id),
        title: String(source.title),
        status: source.status as DashboardLowerObligation["status"],
        due_date: source.due_date as string | null,
        obligation_type: String(source.obligation_type),
        contracts: contract,
      },
    ];
  });
}

function relationContract(value: unknown): { id: string; title: string; organization_id: string } | null {
  const rel = Array.isArray(value) ? value[0] : value;
  const contract = rel as { id?: string; title?: string; organization_id?: string } | null;
  if (!contract?.id || !contract?.title || !contract?.organization_id) return null;
  return {
    id: contract.id,
    title: contract.title,
    organization_id: contract.organization_id,
  };
}

function buildUpcomingActions(dateFields: DashboardDeadlineField[]): DashboardLowerUpcomingAction[] {
  const today = new Date();
  return dateFields
    .filter((field) => field.field_value)
    .map((field) => {
      const dateValue = new Date(field.field_value as string);
      if (!isValid(dateValue)) return null;
      const daysUntil = differenceInDays(dateValue, today);
      if (Number.isNaN(daysUntil)) return null;
      return {
        contract: field.contracts,
        field: {
          id: field.id,
          field_name: field.field_name,
          field_value: field.field_value,
        },
        daysUntil,
      };
    })
    .filter(
      (action): action is DashboardLowerUpcomingAction =>
        action != null && action.daysUntil >= 0 && action.daysUntil <= 30
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);
}

type AuditRow = {
  id: string;
  action: string;
  contract_id: string | null;
  created_at: string;
};

function buildActivityItems({
  tickerAuditRaw,
  recentContracts,
  recentReviewStats,
}: {
  tickerAuditRaw: unknown;
  recentContracts: Contract[];
  recentReviewStats: DashboardLowerSectionsModel["recentReviewStats"];
}): ActivityFeedItem[] {
  const ticker = (tickerAuditRaw ?? []) as AuditRow[];
  const contractTitleById = new Map(recentContracts.map((contract) => [contract.id, contract.title]));
  const reviewQueueTitles = new Set(
    recentContracts
      .filter((contract) => {
        const stats = recentReviewStats[contract.id];
        return (stats?.pending ?? 0) > 0 || contract.status === "pending_review";
      })
      .map((contract) => contract.title.toLowerCase().trim())
  );
  const seenTitles = new Set<string>();
  return ticker.flatMap((row): ActivityFeedItem[] => {
    const title = row.contract_id ? contractTitleById.get(row.contract_id) : undefined;
    if (!title) return [];
    const titleKey = title.toLowerCase().trim();
    if (reviewQueueTitles.has(titleKey) || seenTitles.has(titleKey)) return [];
    seenTitles.add(titleKey);
    return activityItemForAuditRow(row, title);
  });
}

function activityItemForAuditRow(row: AuditRow, target: string): ActivityFeedItem[] {
  const href = row.contract_id ? `/contracts/${row.contract_id}` : undefined;
  if (row.action === "contract.uploaded") {
    return [{ id: row.id, icon: UploadCloud, tone: "neutral", verb: "Uploaded", target, timestamp: row.created_at, href }];
  }
  if (row.action === "extraction.completed") {
    return [{ id: row.id, icon: FileText, tone: "neutral", verb: "Suggested", target, timestamp: row.created_at, href }];
  }
  if (row.action === "field.approved") {
    return [{ id: row.id, icon: BadgeCheck, tone: "success", verb: "Approved", target, timestamp: row.created_at, href }];
  }
  return [];
}
