import { redirect } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { PERSONAS, type PersonaId } from "@/app/(dashboard)/dashboard/persona/persona-dashboard-config";
import { PersonaDashboardDisabledState, PersonaDashboardView } from "@/app/(dashboard)/dashboard/persona/persona-dashboard-view";
import {
  buildPersonaDashboardModel,
  type ApprovalRow,
  type ContractRow,
  type ObligationRow,
  type RenewalScenarioRow,
  type TaskRow,
} from "@/app/(dashboard)/dashboard/persona/persona-dashboard-model";

export default async function PersonaDashboardPage(props: {
  searchParams: Promise<{ persona?: string }>;
}) {
  if (!isFeatureEnabled("v3PersonaDashboards")) {
    return <PersonaDashboardDisabledState />;
  }

  const { persona: rawPersona } = await props.searchParams;
  const persona = (PERSONAS.find((p) => p.id === rawPersona)?.id ?? "ops") as PersonaId;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { admin, orgId, user, role } = ctx;
  const workspaceRole = role as WorkspaceRole;
  const productSurface = await loadProductSurfaceContext(admin, orgId, workspaceRole);
  if (
    productSurface.mode === "core" &&
    (workspaceRole === "viewer" ||
      workspaceRole === "legal_reviewer" ||
      workspaceRole === "finance_reviewer")
  ) {
    redirect("/dashboard");
  }

  const [contractsRes, tasksRes, obligationsRes, approvalsRes, renewalScenariosRes] = await Promise.all([
    admin
      .from("contracts")
      .select("id, title, health_status, annual_value, owner_id, region, contract_type")
      .eq("organization_id", orgId),
    admin
      .from("contract_tasks")
      .select("id, title, status, priority, assignee_id, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id, title, status, owner_id, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_approvals")
      .select("id, status, due_at, contract_id, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("contract_renewal_scenarios")
      .select("id, contract_id, workspace_status, target_decision_date, blocker, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId),
  ]);

  const model = buildPersonaDashboardModel({
    persona,
    productMode: productSurface.mode,
    userId: user.id,
    contracts: (contractsRes.data ?? []) as ContractRow[],
    tasks: (tasksRes.data ?? []) as TaskRow[],
    obligations: (obligationsRes.data ?? []) as ObligationRow[],
    approvals: (approvalsRes.data ?? []) as ApprovalRow[],
    renewalScenarios: (renewalScenariosRes.data ?? []) as RenewalScenarioRow[],
  });

  return <PersonaDashboardView persona={persona} model={model} />;
}
