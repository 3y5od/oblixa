import type { AdminClient } from "@/lib/assurance/service";
import { gatherPortfolioMetrics } from "@/lib/assurance/portfolio-metrics";
import { nowIso } from "@/lib/decision-intelligence/api";

/**
 * Snapshot for capacity_forecasts.v6_assurance_projection_json (v6.md §12 extension).
 */
export async function buildV6AssuranceProjectionForCapacity(admin: AdminClient, orgId: string) {
  const [
    metrics,
    { count: openFindings },
    { count: publishedPolicies },
    { count: runningPlaybooks },
  ] = await Promise.all([
    gatherPortfolioMetrics(admin, orgId),
    admin
      .from("assurance_findings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_review"]),
    admin
      .from("control_policies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "published"),
    admin
      .from("adaptive_playbook_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "running"),
  ]);

  return {
    generated_at: nowIso(),
    open_assurance_findings: openFindings ?? 0,
    published_control_policies: publishedPolicies ?? 0,
    running_playbook_runs: runningPlaybooks ?? 0,
    avg_assurance_score: metrics.avg_assurance_score,
    avg_renewal_readiness: metrics.avg_renewal_readiness,
    stress_signals: {
      open_exceptions: metrics.open_exceptions + metrics.open_exceptions_in_progress,
      approvals_past_due: metrics.approvals_past_due,
      contracts_without_owner: metrics.contracts_without_owner,
      evidence_stale_proxy: metrics.evidence_stale_proxy,
    },
  };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV6AssuranceProjectionForCapacity as buildAssuranceProjectionForCapacity };
// End version-name compatibility aliases.
