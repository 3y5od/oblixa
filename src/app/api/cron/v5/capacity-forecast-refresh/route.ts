import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";
import { listOrganizationIds, requireV5CronAuth } from "@/lib/v5/cron";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";

export async function GET(request: Request) {
  const unauthorized = requireV5CronAuth(request);
  if (unauthorized) return unauthorized;
  const skipped = requireV5CronFeature("v5SimulationAndIntelligence");
  if (skipped) return skipped;
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);

  let generated = 0;
  for (const orgId of orgIds) {
    const [
      { count: openTasks },
      { count: pendingApprovals },
      { count: openDecisions },
      { data: taskTeamRows },
      { data: approvalTypeRows },
      { count: contractsWithoutOwner },
    ] = await Promise.all([
      admin
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress", "blocked"]),
      admin
        .from("contract_approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending"),
      admin
        .from("decision_workspaces")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"]),
      admin
        .from("contract_tasks")
        .select("team_key")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress", "blocked"])
        .limit(5000),
      admin
        .from("contract_approvals")
        .select("approval_type")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .limit(5000),
      admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("owner_id", null),
    ]);

    const { data: priorForecast } = await admin
      .from("capacity_forecasts")
      .select("forecast_json")
      .eq("organization_id", orgId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const priorFj = priorForecast?.forecast_json as Record<string, unknown> | undefined;
    const priorTasks =
      priorFj && typeof priorFj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] === "number"
        ? (priorFj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] as number)
        : null;
    const deltaOpenVsPrior =
      priorTasks !== null ? (openTasks ?? 0) - priorTasks : null;

    const open_tasks_by_team_key: Record<string, number> = {};
    for (const r of taskTeamRows ?? []) {
      const k =
        typeof r.team_key === "string" && r.team_key.trim() ? r.team_key.trim() : "_unset";
      open_tasks_by_team_key[k] = (open_tasks_by_team_key[k] ?? 0) + 1;
    }

    const pending_approvals_by_type: Record<string, number> = {};
    for (const r of approvalTypeRows ?? []) {
      const t =
        typeof r.approval_type === "string" && r.approval_type.trim()
          ? r.approval_type.trim()
          : "_unset";
      pending_approvals_by_type[t] = (pending_approvals_by_type[t] ?? 0) + 1;
    }

    const generatedAt = new Date().toISOString();
    await admin.from("capacity_forecasts").insert({
      organization_id: orgId,
      forecast_horizon_days: 30,
      forecast_json: {
        [CAPACITY_FORECAST_JSON_KEYS.open_tasks]: openTasks ?? 0,
        [CAPACITY_FORECAST_JSON_KEYS.pending_approvals]: pendingApprovals ?? 0,
        [CAPACITY_FORECAST_JSON_KEYS.open_decisions]: openDecisions ?? 0,
        [CAPACITY_FORECAST_JSON_KEYS.open_tasks_by_team_key]: open_tasks_by_team_key,
        [CAPACITY_FORECAST_JSON_KEYS.pending_approvals_by_type]: pending_approvals_by_type,
        [CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner]: contractsWithoutOwner ?? 0,
        [CAPACITY_FORECAST_JSON_KEYS.delta_open_tasks_vs_prior_run]: deltaOpenVsPrior,
        [CAPACITY_FORECAST_JSON_KEYS.generated_at]: generatedAt,
        [CAPACITY_FORECAST_JSON_KEYS.interpretation]:
          "Heuristic 30-day view from current open tasks, pending approvals, and open decisions. Includes contracts with no owner (under-owned segment) and delta vs prior forecast run. Team keys mirror contract_tasks.team_key; approval buckets use contract_approvals.approval_type.",
      },
      model_version: "v5-baseline-heuristic",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await incrementOrgV5SignalQuality({
      admin,
      organizationId: orgId,
      increments: { v5_capacity_forecast_cron_runs: 1 },
    });
    generated += 1;
  }

  return NextResponse.json({ ok: true, forecastsGenerated: generated });
}

