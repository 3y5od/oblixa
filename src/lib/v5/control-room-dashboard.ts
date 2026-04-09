import type { SupabaseClient } from "@supabase/supabase-js";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";
import { buildPortfolioSignalSummary } from "@/lib/v5/portfolio-signal-summary";

export type ControlRoomLiveCard = {
  title: string;
  description: string;
  href: string;
  /** Short grounded headline, e.g. counts or delta */
  metricLabel: string;
};

function signalValue(
  rows: { key: string; value: number }[],
  key: string
): number {
  return rows.find((r) => r.key === key)?.value ?? 0;
}

/**
 * Portfolio counts + capacity delta for the home control-room strip (v5.md §15).
 */
export async function fetchControlRoomDashboardData(
  admin: SupabaseClient,
  orgId: string
): Promise<{
  cards: ControlRoomLiveCard[];
}> {
  const { signalSummary } = await buildPortfolioSignalSummary(admin, orgId);
  const rows = signalSummary.map((s) => ({ key: s.key, value: s.value }));

  const openTasks = signalValue(rows, "workload_execution_spike");
  const openDecisions = signalValue(rows, "stalled_decision_risk");
  const activeCampaigns = signalValue(rows, "policy_divergence_risk");
  const campaignBacklog = signalValue(rows, "campaign_execution_backlog");
  const pendingApprovals = signalValue(rows, "approval_queue_pressure");
  const openExceptions = signalValue(rows, "overdue_operational_risk");
  const renewalCheckpoints = signalValue(rows, "renewal_readiness_gap");
  const staleExceptions = signalValue(rows, "stale_exception_backlog");

  const { data: forecasts } = await admin
    .from("capacity_forecasts")
    .select("forecast_json")
    .eq("organization_id", orgId)
    .order("generated_at", { ascending: false })
    .limit(2);

  const latestFj = forecasts?.[0]?.forecast_json as Record<string, unknown> | undefined;
  const prevFj = forecasts?.[1]?.forecast_json as Record<string, unknown> | undefined;
  const openTasksKey = CAPACITY_FORECAST_JSON_KEYS.open_tasks;
  const deltaTasks =
    latestFj &&
    prevFj &&
    typeof latestFj[openTasksKey] === "number" &&
    typeof prevFj[openTasksKey] === "number"
      ? (latestFj[openTasksKey] as number) - (prevFj[openTasksKey] as number)
      : null;
  const latestOpenTasksForecast =
    latestFj && typeof latestFj[openTasksKey] === "number"
      ? (latestFj[openTasksKey] as number)
      : null;

  let capacityMetric: string;
  if (deltaTasks !== null) {
    const sign = deltaTasks > 0 ? "+" : "";
    capacityMetric = `Open tasks Δ vs prior forecast: ${sign}${deltaTasks}`;
  } else if (latestOpenTasksForecast !== null) {
    capacityMetric = `Forecast open tasks: ${latestOpenTasksForecast}`;
  } else {
    capacityMetric = "Run capacity refresh to see forecast";
  }

  const cards: ControlRoomLiveCard[] = [
    {
      title: "What needs action now?",
      description: "Open execution tasks across the portfolio.",
      href: "/work",
      metricLabel: `${openTasks} open tasks`,
    },
    {
      title: "What needs a decision now?",
      description: "Decision workspaces in open or in review.",
      href: "/decisions",
      metricLabel: `${openDecisions} open decisions`,
    },
    {
      title: "What is spreading?",
      description: "Active campaigns and rollout backlog.",
      href: "/campaigns",
      metricLabel: `${activeCampaigns} campaigns · ${campaignBacklog} contract rows in flight`,
    },
    {
      title: "What may break soon?",
      description: "Approval queue and open exceptions (SLA pressure).",
      href: "/reports#portfolio-signals",
      metricLabel: `${pendingApprovals} pending approvals · ${openExceptions} open exceptions`,
    },
    {
      title: "Where is capacity thin?",
      description: "Latest capacity forecast snapshot.",
      href: "/reports#capacity-forecasts",
      metricLabel: capacityMetric,
    },
    {
      title: "What changed since last review?",
      description: "Renewal checkpoints, stale exceptions, and campaign execution drift.",
      href: "/campaigns",
      metricLabel: `${renewalCheckpoints} renewal checkpoints · ${staleExceptions} stale open exceptions`,
    },
  ];

  return { cards };
}
