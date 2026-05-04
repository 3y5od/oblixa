import { orgHasActivePlan } from "@/lib/plan";
import { getV10PlanRank } from "@/lib/v10-release-contract";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  minimumPlanForWorkspaceMode,
  resolveExplicitWorkspacePlan,
  type ProductSurfaceActionContext,
} from "./product-surface-settings-helpers";

export async function validateWorkspaceModeBillingEligibility(input: {
  admin: ProductSurfaceActionContext["admin"];
  orgId: string;
  mode: WorkspaceProductMode;
  prevSettings: unknown;
}): Promise<string | null> {
  const explicitPlan = resolveExplicitWorkspacePlan(input.prevSettings);
  const minimumPlan = minimumPlanForWorkspaceMode(input.mode);
  if (explicitPlan && getV10PlanRank(explicitPlan) < getV10PlanRank(minimumPlan)) {
    return `${input.mode[0].toUpperCase()}${input.mode.slice(1)} mode is not included in the current workspace billing plan. Open Billing before saving this change.`;
  }
  if (!explicitPlan && input.mode !== "core") {
    const hasActivePlan = await orgHasActivePlan(input.admin, input.orgId).catch(() => false);
    if (!hasActivePlan) {
      return `${input.mode[0].toUpperCase()}${input.mode.slice(1)} mode requires an active billing plan. Open Billing before saving this change.`;
    }
  }
  return null;
}