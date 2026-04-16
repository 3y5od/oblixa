import { createAdminClient } from "@/lib/supabase/server";
import { persistContractDataQualitySnapshot } from "@/lib/data-quality";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export async function recomputeContractSignals(
  admin: AdminClient,
  contractId: string
): Promise<
  | {
      ok: true;
      organizationId: string;
      healthStatus: "healthy" | "watch" | "at_risk" | "unknown";
      requiredNextStep: string | null;
    }
  | { ok: false; reason: string }
> {
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id, owner_assigned_at, status, intake_status")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { ok: false, reason: "contract_not_found" };

  const today = new Date().toISOString().slice(0, 10);
  const [settingsRes, fieldsRes, tasksRes, obligationsRes, remindersRes, approvalsRes, scenarioRes, watchlistRes] =
    await Promise.all([
      admin
        .from("organization_workflow_settings")
        .select("stale_ownership_days")
        .eq("organization_id", contract.organization_id)
        .maybeSingle(),
    admin
      .from("extracted_fields")
      .select("field_name, status")
      .eq("contract_id", contractId)
      .in("field_name", ["end_date", "renewal_date", "notice_window"]),
    admin
      .from("contract_tasks")
      .select("status, due_date")
      .eq("contract_id", contractId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("status, due_date")
      .eq("contract_id", contractId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("reminders")
      .select("reminder_date, sent_at")
      .eq("contract_id", contractId)
      .is("sent_at", null),
      admin
        .from("contract_approvals")
        .select("id")
        .eq("contract_id", contractId)
        .eq("status", "pending"),
      admin
        .from("contract_renewal_scenarios")
        .select("scenario, blocker")
        .eq("contract_id", contractId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("contract_watchlists")
        .select("id", { count: "exact", head: true })
        .eq("contract_id", contractId),
    ]);

  const queryErrors = [
    settingsRes.error,
    fieldsRes.error,
    tasksRes.error,
    obligationsRes.error,
    remindersRes.error,
    approvalsRes.error,
    scenarioRes.error,
    watchlistRes.error,
  ].filter(Boolean);
  if (queryErrors.length > 0) {
    for (const err of queryErrors) console.error("workflow-signals query failed:", err);
    return { ok: false, reason: "query_failed" };
  }

  const settings = settingsRes.data;

  const approvedFields = new Set(
    (fieldsRes.data ?? []).filter((f) => f.status === "approved").map((f) => f.field_name)
  );
  const missingCriticalDates = approvedFields.size < 2;
  const ownerMissing = !contract.owner_id;
  const overdueTasks = (tasksRes.data ?? []).filter((t) => t.due_date && t.due_date < today).length;
  const overdueObligations = (obligationsRes.data ?? []).filter((o) => o.due_date && o.due_date < today).length;
  const upcomingSoon = (remindersRes.data ?? []).filter((r) => r.reminder_date <= today).length;
  const pendingApprovals = approvalsRes.data?.length ?? 0;
  const renewalBlocked = Boolean(scenarioRes.data?.blocker);
  const scenarioAwaitingDecision = scenarioRes.data?.scenario === "awaiting_decision";
  const watchlistCount = watchlistRes.count ?? 0;
  const staleOwnershipDays = Math.max(14, Number(settings?.stale_ownership_days ?? 90));
  const staleOwnership =
    !!contract.owner_id &&
    !!contract.owner_assigned_at &&
    (Date.now() - new Date(contract.owner_assigned_at).getTime()) / (24 * 60 * 60 * 1000) >
      staleOwnershipDays;

  let healthStatus: "healthy" | "watch" | "at_risk" | "unknown" = "healthy";
  if (
    ownerMissing ||
    missingCriticalDates ||
    overdueTasks > 0 ||
    overdueObligations > 0 ||
    pendingApprovals > 0 ||
    renewalBlocked ||
    staleOwnership
  ) {
    healthStatus = "at_risk";
  } else if (upcomingSoon > 0 || watchlistCount > 0 || scenarioAwaitingDecision) {
    healthStatus = "watch";
  }

  let requiredNextStep: string | null = null;
  if (ownerMissing) {
    requiredNextStep = "Assign a contract owner";
  } else if (missingCriticalDates) {
    requiredNextStep = "Approve key date fields (end/renewal/notice)";
  } else if (overdueTasks > 0) {
    requiredNextStep = "Resolve overdue contract tasks";
  } else if (overdueObligations > 0) {
    requiredNextStep = "Resolve overdue obligations";
  } else if (pendingApprovals > 0) {
    requiredNextStep = "Resolve pending approvals";
  } else if (renewalBlocked) {
    requiredNextStep = "Resolve renewal blocker";
  } else if (staleOwnership) {
    requiredNextStep = "Confirm owner is still current";
  } else if (upcomingSoon > 0) {
    requiredNextStep = "Review imminent reminders";
  } else if (scenarioAwaitingDecision) {
    requiredNextStep = "Record renewal decision";
  } else if (watchlistCount > 0) {
    requiredNextStep = "Review watchlist entries";
  }

  await admin
    .from("contracts")
    .update({
      health_status: healthStatus,
      required_next_step: requiredNextStep,
    })
    .eq("id", contractId);
  await persistContractDataQualitySnapshot(admin, contractId);

  return {
    ok: true,
    organizationId: contract.organization_id,
    healthStatus,
    requiredNextStep,
  };
}
