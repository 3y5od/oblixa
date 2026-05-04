import type { SemanticStatus } from "@/components/ui/status-badge";
import { getV10WorkItemHref } from "@/lib/v10-job-routing";
import { V9_DUE_SOON_DAYS } from "@/lib/v9-business-dates";
import type { V10WorkReadModelRow } from "@/lib/v10-work-semantics";
import type { WorkHubLens } from "@/lib/work-hub-lens";
import type { V10WorkItemType } from "@/lib/v10-release-contract";

export function toSemanticStatus(status: string): SemanticStatus {
  if (status === "blocked") return "blocked";
  if (status === "in_progress") return "in_review";
  if (status === "pending") return "warning";
  if (status === "open") return "info";
  return "empty";
}

export function lensHref(lens: WorkHubLens) {
  return lens === "assigned" ? "/work" : `/work?lens=${lens}`;
}

export type V10WorkActionRow = V10WorkReadModelRow & {
  contract_id?: string | null;
  primary_action?: string | null;
};

export function v10PrimaryActionHref(item: V10WorkActionRow, fallbackHref: string): string {
  const contractHref = item.contract_id ? `/contracts/${item.contract_id}` : fallbackHref;
  switch (item.primary_action) {
    case "assign_owner":
      return item.contract_id ? `${contractHref}#ownership-record` : "/work?lens=unassigned";
    case "approve_approval":
    case "reject_approval":
      return item.contract_id ? `${contractHref}?tab=overview#renewal-approvals` : fallbackHref;
    case "request_evidence":
    case "accept_evidence":
    case "reject_evidence":
      return item.contract_id ? `${contractHref}?tab=overview#contract-evidence` : fallbackHref;
    case "resolve_exception":
      return item.contract_id ? `/contracts/exceptions?status=open&contract=${item.contract_id}` : "/contracts/exceptions";
    case "retry_failed_job":
      return getV10WorkItemHref({
        type: item.type as V10WorkItemType,
        sourceId: String(item.source_id ?? ""),
        contractId: item.contract_id ?? null,
        primaryAction: item.primary_action,
        fallbackHref,
      });
    default:
      return contractHref;
  }
}

type WorkSectionId = "tasks" | "approvals" | "obligations" | "exceptions";

export function workSectionHref(lens: WorkHubLens, section: WorkSectionId) {
  return `${lensHref(lens)}#${section}`;
}

export function tasksEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts", label: "Browse contracts" };
    case "due_soon":
      return { href: "/contracts/renewals?horizon=renewal_30", label: `Open renewals (≤${V9_DUE_SOON_DAYS}d)` };
    case "overdue":
      return { href: "/contracts/renewals?horizon=end_30", label: "Open end-date pressure (≤30d)" };
    case "blocked":
      return { href: workSectionHref("blocked", "tasks"), label: "Stay on blocked tasks" };
    case "recent":
      return { href: lensHref("assigned"), label: "Return to open work" };
    default:
      return { href: lensHref("assigned"), label: "Open assigned work" };
  }
}

export function obligationsEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts/obligations", label: "Open obligations ledger" };
    case "due_soon":
      return { href: lensHref("assigned"), label: "See all assigned obligations" };
    case "overdue":
      return { href: lensHref("overdue"), label: "Focus overdue lens" };
    case "blocked":
      return { href: lensHref("assigned"), label: "Review assigned obligations" };
    case "recent":
      return { href: lensHref("assigned"), label: "Pick up open obligations" };
    default:
      return { href: lensHref("assigned"), label: "Open assigned work" };
  }
}

export function approvalsEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts/approvals?status=pending", label: "Open pending approvals" };
    case "due_soon":
      return { href: "/contracts/approvals?status=pending", label: "Review approval due dates" };
    case "overdue":
      return { href: "/contracts/approvals?status=pending", label: "Clear overdue approvals" };
    case "blocked":
      return { href: "/contracts/approvals", label: "Open approvals workspace" };
    case "recent":
      return { href: "/contracts/approvals", label: "View approvals history" };
    default:
      return { href: "/contracts/approvals?status=pending", label: "Open pending approvals" };
  }
}

export function exceptionsEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts/exceptions?status=open", label: "Open exception ledger" };
    case "due_soon":
      return { href: "/contracts/exceptions?status=open", label: "Prioritize dated exceptions" };
    case "overdue":
      return { href: "/contracts/exceptions?status=open", label: "Triage overdue exceptions" };
    case "blocked":
      return { href: "/contracts/exceptions?status=open", label: "Review open exceptions" };
    case "recent":
      return { href: "/contracts/exceptions?status=resolved", label: "Browse resolved exceptions" };
    default:
      return { href: "/contracts/exceptions?status=open", label: "Open active exception ledger" };
  }
}