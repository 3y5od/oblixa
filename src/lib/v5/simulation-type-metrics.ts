import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimulationType } from "@/lib/v5/simulation-types";

type Admin = SupabaseClient;

/** Grounded counts merged into change_simulation_runs.result_json.metric_matrix. */
export async function buildSimulationTypeSpecificSignals(
  admin: Admin,
  organizationId: string,
  simulationType: SimulationType,
  sampleContractIds: string[]
): Promise<Record<string, unknown>> {
  const scopedIds = sampleContractIds.slice(0, 50);

  switch (simulationType) {
    case "campaign_eligibility_impact": {
      const { count, error } = await admin
        .from("portfolio_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["active", "paused"]);
      if (error) console.error("[simulation-type-metrics] campaign_eligibility_impact query failed:", error.message);
      return { active_or_paused_campaigns: count ?? 0 };
    }
    case "program_update_impact": {
      const [{ count: programs, error: e1 }, { count: assignments, error: e2 }] = await Promise.all([
        admin
          .from("contract_programs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        admin
          .from("contract_program_assignments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "active"),
      ]);
      if (e1) console.error("[simulation-type-metrics] programs query failed:", e1.message);
      if (e2) console.error("[simulation-type-metrics] assignments query failed:", e2.message);
      return {
        catalog_programs: programs ?? 0,
        active_program_assignments: assignments ?? 0,
      };
    }
    case "approval_sla_change_impact": {
      const [{ count: pending, error: e1 }, { count: slaRows, error: e2 }] = await Promise.all([
        admin
          .from("contract_approvals")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "pending"),
        admin
          .from("approval_slas")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
      ]);
      if (e1) console.error("[simulation-type-metrics] pending approvals query failed:", e1.message);
      if (e2) console.error("[simulation-type-metrics] approval SLA query failed:", e2.message);
      return { pending_contract_approvals: pending ?? 0, approval_sla_rules: slaRows ?? 0 };
    }
    case "evidence_requirement_rollout_impact": {
      const { count, error } = await admin
        .from("evidence_requirements")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "required");
      if (error) console.error("[simulation-type-metrics] evidence_requirement query failed:", error.message);
      return { unsatisfied_evidence_requirements: count ?? 0 };
    }
    case "escalation_policy_change_impact": {
      const { count, error } = await admin
        .from("exceptions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["open", "in_progress"]);
      if (error) console.error("[simulation-type-metrics] escalation_policy query failed:", error.message);
      return { open_exceptions_for_escalation_surface: count ?? 0 };
    }
    case "renewal_playbook_change_impact": {
      const { count, error } = await admin
        .from("contract_renewal_checkpoints")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "pending");
      if (error) console.error("[simulation-type-metrics] renewal_playbook query failed:", error.message);
      return { pending_renewal_checkpoints: count ?? 0 };
    }
    case "routing_policy_change_impact": {
      let openTasks = 0;
      if (scopedIds.length > 0) {
        const { count, error } = await admin
          .from("contract_tasks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .in("contract_id", scopedIds)
          .in("status", ["open", "in_progress", "blocked"]);
        if (error) console.error("[simulation-type-metrics] routing_policy tasks query failed:", error.message);
        openTasks = count ?? 0;
      }
      return {
        open_tasks_on_sample_contracts: openTasks,
        sample_contracts_used: scopedIds.length,
      };
    }
    case "reporting_cadence_impact": {
      const { count, error } = await admin
        .from("report_packs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (error) console.error("[simulation-type-metrics] reporting_cadence query failed:", error.message);
      return { report_packs_configured: count ?? 0 };
    }
    default:
      return {};
  }
}
