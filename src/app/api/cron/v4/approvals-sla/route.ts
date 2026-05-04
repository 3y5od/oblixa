import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";
import { getApprovalSlaFallbackHours } from "@/lib/v4/policy-registry";

type SlaRow = {
  id: string;
  organization_id: string;
  approval_type: string;
  contract_type: string | null;
  sla_hours: number;
  breach_hours: number | null;
};

function selectSla(
  slas: SlaRow[],
  approvalType: string,
  contractType: string | null
): SlaRow | null {
  const exact = slas.find((row) => row.approval_type === approvalType && row.contract_type === contractType);
  if (exact) return exact;
  const typeDefault = slas.find((row) => row.approval_type === approvalType && row.contract_type === null);
  if (typeDefault) return typeDefault;
  return slas.find((row) => row.approval_type === "default" && row.contract_type === null) ?? null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/approvals-sla",
  healthcheckRoute: "cron/v4/approvals-sla",
  rateLimitKey: "cron:v4:approvals-sla",
  rateLimit: RATE_LIMITS.v4ApprovalSlaCron,
  handler: async ({ admin }) => {
    const { data: approvals } = await admin
      .from("contract_approvals")
      .select("id, organization_id, contract_id, approval_type, created_at, due_at, status, sla_id")
      .eq("status", "pending")
      .limit(500);
    const rows = approvals ?? [];
    const nowIso = new Date().toISOString();
    const orgIds = Array.from(new Set(rows.map((row) => row.organization_id)));
    const contractIds = Array.from(new Set(rows.map((row) => row.contract_id).filter(Boolean)));
    const [{ data: slas }, { data: contracts }, { data: policySettings }] = await Promise.all([
      orgIds.length === 0
        ? Promise.resolve({ data: [] as SlaRow[] })
        : admin
            .from("approval_slas")
            .select("id, organization_id, approval_type, contract_type, sla_hours, breach_hours")
            .in("organization_id", orgIds)
            .eq("active", true),
      contractIds.length === 0
        ? Promise.resolve({ data: [] as Array<{ id: string; contract_type: string | null }> })
        : admin.from("contracts").select("id, contract_type").in("id", contractIds),
      orgIds.length === 0
        ? Promise.resolve({ data: [] as Array<{ organization_id: string; v4_policy_registry_json: unknown }> })
        : admin
            .from("organization_workflow_settings")
            .select("organization_id, v4_policy_registry_json")
            .in("organization_id", orgIds),
    ]);
    const slasByOrg = new Map<string, SlaRow[]>();
    for (const row of slas ?? []) {
      const group = slasByOrg.get(row.organization_id) ?? [];
      group.push(row);
      slasByOrg.set(row.organization_id, group);
    }
    const contractTypeById = new Map((contracts ?? []).map((row) => [row.id, row.contract_type ?? null]));
    const policyHoursByOrg = new Map<string, number | null>();
    for (const s of policySettings ?? []) {
      policyHoursByOrg.set(
        s.organization_id as string,
        getApprovalSlaFallbackHours(s.v4_policy_registry_json)
      );
    }

    let breaches = 0;
    for (const row of rows) {
      const contractType = contractTypeById.get(row.contract_id) ?? null;
      const sla = selectSla(slasByOrg.get(row.organization_id) ?? [], row.approval_type, contractType);
      const policyFallback = policyHoursByOrg.get(row.organization_id) ?? null;
      const slaHours = Number(sla?.sla_hours ?? policyFallback ?? 72);
      const breachHours = Number(sla?.breach_hours ?? slaHours);
      const createdAtMs = new Date(row.created_at).getTime();
      if (!Number.isFinite(createdAtMs)) continue;
      const dueAt = new Date(createdAtMs + slaHours * 60 * 60 * 1000).toISOString();
      const breachAt = new Date(createdAtMs + breachHours * 60 * 60 * 1000).toISOString();
      const isBreached = breachAt <= nowIso;
      await admin
        .from("contract_approvals")
        .update({
          due_at: dueAt,
          sla_id: sla?.id ?? null,
          escalation_status: isBreached ? "pending" : "none",
          escalation_at: isBreached ? nowIso : null,
        })
        .eq("id", row.id);

      if (isBreached) {
        breaches += 1;
        await admin.from("contract_approval_events").insert({
          organization_id: row.organization_id,
          contract_id: row.contract_id,
          approval_id: row.id,
          actor_id: null,
          event_type: "sla_breached",
          details: {
            sla_id: sla?.id ?? null,
            sla_hours: slaHours,
            breach_hours: breachHours,
            breached_at: nowIso,
          },
        });
        await recordAutomationEvent({
          admin,
          organizationId: row.organization_id,
          contractId: row.contract_id,
          action: "approvals_sla_breach",
          entityType: "approval",
          entityId: row.id,
          details: { sla_id: sla?.id ?? null, sla_hours: slaHours, breach_hours: breachHours },
        });
      }
    }

    return {
      body: {
        breaches,
        evaluated: rows.length,
      },
    };
  },
});
