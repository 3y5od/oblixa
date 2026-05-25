import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/decision-intelligence/capacity-forecast-keys";
import {
  buildPortfolioSignalSummary,
  type PortfolioSignalRow,
  type PortfolioSignalSeverity,
} from "@/lib/decision-intelligence/portfolio-signal-summary";

export type ControlRoomCardId =
  | "action_required"
  | "decisions"
  | "propagation"
  | "approval_risk"
  | "capacity"
  | "change_review";

/** Visual / semantic state for the strip card chrome */
export type ControlRoomCardTone = OperationalTone;

export type ControlRoomBreakdownItem = {
  label: string;
  /** Short display value (already formatted if needed) */
  value: string;
};

export type ControlRoomLiveCard = {
  id: ControlRoomCardId;
  /** Small muted label (uppercased in UI) */
  eyebrow: string;
  /** Short noun-phrase title */
  headline: string;
  /** Dominant numeric metric (null → show fallbackText) */
  primaryValue: number | null;
  /** Shown when primaryValue is null, e.g. "—" or "No data" */
  primaryFallback?: string;
  /** Unit or noun after the number, e.g. "tasks" */
  primaryUnit?: string;
  secondaryLine?: string;
  breakdown: ControlRoomBreakdownItem[];
  href: string;
  actionLabel: string;
  tone: ControlRoomCardTone;
};

function signalRow(
  rows: PortfolioSignalRow[],
  key: string
): PortfolioSignalRow | undefined {
  return rows.find((r) => r.key === key);
}

function toneFromSignal(
  value: number,
  severity: PortfolioSignalSeverity | undefined
): ControlRoomCardTone {
  if (value === 0) return "healthy";
  if (severity === "high") return "risk";
  if (severity === "medium") return "attention";
  return "neutral";
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
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

  const workload = signalRow(signalSummary, "workload_execution_spike");
  const openTasks = workload?.value ?? 0;

  const decisionsRow = signalRow(signalSummary, "stalled_decision_risk");
  const openDecisions = decisionsRow?.value ?? 0;

  const campaignsRow = signalRow(signalSummary, "policy_divergence_risk");
  const activeCampaigns = campaignsRow?.value ?? 0;
  const backlogRow = signalRow(signalSummary, "campaign_execution_backlog");
  const campaignBacklog = backlogRow?.value ?? 0;

  const approvalsRow = signalRow(signalSummary, "approval_queue_pressure");
  const pendingApprovals = approvalsRow?.value ?? 0;
  const exceptionsRow = signalRow(signalSummary, "overdue_operational_risk");
  const openExceptions = exceptionsRow?.value ?? 0;

  const renewalRow = signalRow(signalSummary, "renewal_readiness_gap");
  const renewalCheckpoints = renewalRow?.value ?? 0;
  const staleRow = signalRow(signalSummary, "stale_exception_backlog");
  const staleExceptions = staleRow?.value ?? 0;

  const { data: forecasts } = await admin
    .from("capacity_forecasts")
    .select("forecast_json, forecast_horizon_days")
    .eq("organization_id", orgId)
    .order("generated_at", { ascending: false })
    .limit(2);

  const latestFj = forecasts?.[0]?.forecast_json as Record<string, unknown> | undefined;
  const prevFj = forecasts?.[1]?.forecast_json as Record<string, unknown> | undefined;
  const sameHorizon =
    forecasts?.[0]?.forecast_horizon_days != null &&
    forecasts?.[0]?.forecast_horizon_days === forecasts?.[1]?.forecast_horizon_days;
  const openTasksKey = CAPACITY_FORECAST_JSON_KEYS.open_tasks;
  const deltaTasks =
    sameHorizon &&
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

  let capacityCard: ControlRoomLiveCard;
  if (deltaTasks !== null && latestOpenTasksForecast !== null) {
    const capTone: ControlRoomCardTone =
      deltaTasks > 0 ? "risk" : deltaTasks < 0 ? "healthy" : "neutral";
    capacityCard = {
      id: "capacity",
      eyebrow: "Forecast",
      headline: "Capacity",
      primaryValue: latestOpenTasksForecast,
      primaryUnit: "open tasks",
      breakdown: [{ label: "Δ vs prior run", value: formatDelta(deltaTasks) }],
      href: "/reports#capacity-forecasts",
      actionLabel: "View capacity",
      tone: capTone,
    };
  } else if (latestOpenTasksForecast !== null) {
    capacityCard = {
      id: "capacity",
      eyebrow: "Forecast",
      headline: "Capacity",
      primaryValue: latestOpenTasksForecast,
      primaryUnit: "open tasks",
      breakdown: [],
      href: "/reports#capacity-forecasts",
      actionLabel: "View capacity",
      tone: "neutral",
    };
  } else {
    capacityCard = {
      id: "capacity",
      eyebrow: "Forecast",
      headline: "Capacity",
      primaryValue: null,
      primaryFallback: "—",
      secondaryLine: "Run capacity refresh",
      breakdown: [],
      href: "/reports#capacity-forecasts",
      actionLabel: "View capacity",
      tone: "neutral",
    };
  }

  const propagationTone: ControlRoomCardTone =
    campaignBacklog > 0
      ? toneFromSignal(campaignBacklog, backlogRow?.severity)
      : activeCampaigns > 0
        ? "neutral"
        : "healthy";

  const approvalTone: ControlRoomCardTone = (() => {
    const worst =
      pendingApprovals >= openExceptions
        ? approvalsRow?.severity
        : exceptionsRow?.severity;
    const maxVal = Math.max(pendingApprovals, openExceptions);
    return toneFromSignal(maxVal, worst);
  })();

  const changeTone: ControlRoomCardTone = (() => {
    const total = renewalCheckpoints + staleExceptions;
    const worst =
      staleExceptions >= renewalCheckpoints ? staleRow?.severity : renewalRow?.severity;
    return toneFromSignal(total, worst);
  })();

  const cards: ControlRoomLiveCard[] = [
    {
      id: "action_required",
      eyebrow: "Execution",
      headline: "Action required",
      primaryValue: openTasks,
      primaryUnit: "open tasks",
      breakdown: [],
      href: "/work",
      actionLabel: "View tasks",
      tone: toneFromSignal(openTasks, workload?.severity),
    },
    {
      id: "decisions",
      eyebrow: "Governance",
      headline: "Decisions",
      primaryValue: openDecisions,
      primaryUnit: "open / in review",
      breakdown: [],
      href: "/decisions",
      actionLabel: "View decisions",
      tone: toneFromSignal(openDecisions, decisionsRow?.severity),
    },
    {
      id: "propagation",
      eyebrow: "Campaigns",
      headline: "Propagation",
      primaryValue: activeCampaigns,
      primaryUnit: "active",
      breakdown: [{ label: "Contract rows in flight", value: String(campaignBacklog) }],
      href: "/campaigns",
      actionLabel: "View campaigns",
      tone: propagationTone,
    },
    {
      id: "approval_risk",
      eyebrow: "SLA pressure",
      headline: "Approval risk",
      primaryValue: pendingApprovals,
      primaryUnit: "pending approvals",
      breakdown: [{ label: "Open exceptions", value: String(openExceptions) }],
      href: "/reports#portfolio-signals",
      actionLabel: "View signals",
      tone: approvalTone,
    },
    capacityCard,
    {
      id: "change_review",
      eyebrow: "Drift",
      headline: "Change since review",
      primaryValue: renewalCheckpoints,
      primaryUnit: "pending checkpoints",
      breakdown: [{ label: "Stale exceptions (90d+)", value: String(staleExceptions) }],
      href: "/campaigns",
      actionLabel: "View campaigns",
      tone: changeTone,
    },
  ];

  return { cards };
}

/** Static strip when live portfolio signals are unavailable (same shape as `fetchControlRoomDashboardData`). */
export const CONTROL_ROOM_STRIP_FALLBACK: ControlRoomLiveCard[] = [
  {
    id: "action_required",
    eyebrow: "Execution",
    headline: "Action required",
    primaryValue: 0,
    primaryUnit: "open tasks",
    breakdown: [],
    href: "/work",
    actionLabel: "View tasks",
    tone: "healthy",
  },
  {
    id: "decisions",
    eyebrow: "Governance",
    headline: "Decisions",
    primaryValue: 0,
    primaryUnit: "open / in review",
    breakdown: [],
    href: "/decisions",
    actionLabel: "View decisions",
    tone: "healthy",
  },
  {
    id: "propagation",
    eyebrow: "Campaigns",
    headline: "Propagation",
    primaryValue: 0,
    primaryUnit: "active",
    breakdown: [{ label: "Contract rows in flight", value: "0" }],
    href: "/campaigns",
    actionLabel: "View campaigns",
    tone: "healthy",
  },
  {
    id: "approval_risk",
    eyebrow: "SLA pressure",
    headline: "Approval risk",
    primaryValue: 0,
    primaryUnit: "pending approvals",
    breakdown: [{ label: "Open exceptions", value: "0" }],
    href: "/reports#portfolio-signals",
    actionLabel: "View signals",
    tone: "healthy",
  },
  {
    id: "capacity",
    eyebrow: "Forecast",
    headline: "Capacity",
    primaryValue: null,
    primaryFallback: "—",
    secondaryLine: "Enable forecasts",
    breakdown: [],
    href: "/reports#capacity-forecasts",
    actionLabel: "View capacity",
    tone: "neutral",
  },
  {
    id: "change_review",
    eyebrow: "Drift",
    headline: "Change since review",
    primaryValue: 0,
    primaryUnit: "pending checkpoints",
    breakdown: [{ label: "Stale exceptions (90d+)", value: "0" }],
    href: "/campaigns",
    actionLabel: "View campaigns",
    tone: "healthy",
  },
];
