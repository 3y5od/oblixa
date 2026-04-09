import { Suspense } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardUpper } from "@/components/dashboard/dashboard-upper";
import { DashboardLower } from "@/components/dashboard/dashboard-lower";
import { V5ControlRoomStrip } from "@/components/dashboard/v5-control-room-strip";
import type { WorkspaceRole } from "@/lib/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { fetchControlRoomDashboardData } from "@/lib/v5/control-room-dashboard";
import { V5TelemetryCompact } from "@/components/dashboard/v5-telemetry-compact";
import { parseV5SignalQualityForDisplay } from "@/lib/v5/v5-signal-quality-labels";

function DashboardUpperFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-40 animate-pulse rounded-2xl bg-zinc-100/80" />
      <div className="h-24 animate-pulse rounded-2xl bg-zinc-100/80" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100/80" />
    </div>
  );
}

function DashboardLowerFallback() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100/80" />
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-zinc-100/80" />
    </div>
  );
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ view?: string; qf?: string }>;
}) {
  const { view: rawView, qf: rawQuickFilter } = await props.searchParams;
  const view =
    rawView === "team" || rawView === "portfolio" || rawView === "personal"
      ? rawView
      : "personal";
  const quickFilter =
    rawQuickFilter === "approvals" ||
    rawQuickFilter === "deadlines" ||
    rawQuickFilter === "data_gaps"
      ? rawQuickFilter
      : "all";
  const ctx = await getAuthContext();
  if (!ctx) {
    return <WorkspaceRequiredState />;
  }

  const { orgId, user, role, admin } = ctx;
  const workspaceRole = role as WorkspaceRole;
  const showControlRoomStrip = isFeatureEnabled("v5ControlRoomUx");
  const intelligenceOn = isFeatureEnabled("v5SimulationAndIntelligence");
  const liveControlRoom = showControlRoomStrip
    ? await fetchControlRoomDashboardData(admin, orgId)
    : null;

  const canViewV5Telemetry =
    workspaceRole === "admin" ||
    workspaceRole === "manager" ||
    workspaceRole === "ops_manager";
  let telemetryCompact: { metricsDate: string; rows: ReturnType<typeof parseV5SignalQualityForDisplay> } | null =
    null;
  if ((intelligenceOn || showControlRoomStrip) && canViewV5Telemetry) {
    const { data } = await admin
      .from("org_behavior_metrics")
      .select("metrics_date, v5_signal_quality_json")
      .eq("organization_id", orgId)
      .order("metrics_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.metrics_date) {
      telemetryCompact = {
        metricsDate: data.metrics_date,
        rows: parseV5SignalQualityForDisplay(data.v5_signal_quality_json),
      };
    }
  }

  return (
    <div className="space-y-7 md:space-y-8">
      {showControlRoomStrip ? (
        <V5ControlRoomStrip liveCards={liveControlRoom?.cards} />
      ) : null}
      {telemetryCompact ? (
        <V5TelemetryCompact metricsDate={telemetryCompact.metricsDate} rows={telemetryCompact.rows} />
      ) : null}
      <Suspense fallback={<DashboardUpperFallback />}>
        <DashboardUpper
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
        />
      </Suspense>
      <Suspense fallback={<DashboardLowerFallback />}>
        <DashboardLower
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
        />
      </Suspense>
    </div>
  );
}
