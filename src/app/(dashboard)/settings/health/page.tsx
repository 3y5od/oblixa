import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getOrgMemberRole } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";

export default async function SettingsHealthPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user } = ctx;

  const [role, workflowSettingsRes] = await Promise.all([
    getOrgMemberRole(admin, user.id, orgId),
    admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);
  const canOpenHealth = hasRoleCapability({
    role,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettingsRes.data?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
  if (!canOpenHealth) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="ui-eyebrow">Workspace</p>
        <h1 className="ui-display-title mt-2">System health</h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
          You do not have permission to view operational health details for this workspace.
        </p>
      </div>
    );
  }

  const [webhookRes, reportRunsRes, cronAuditRes, pendingRes, retryingRes, failedRes, suppressedRes] =
    await Promise.all([
      admin
        .from("outbound_event_deliveries")
        .select("delivered, attempt_count, next_attempt_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("report_runs")
        .select("status, started_at")
        .eq("organization_id", orgId)
        .order("started_at", { ascending: false })
        .limit(100),
      admin
        .from("audit_events")
        .select("action, created_at")
        .eq("organization_id", orgId)
        .in("action", [
          "integration.calendar_sync_run",
          "maintenance.correction_campaign",
          "maintenance.change_events_processed",
          "notifications.retry_deliveries_run",
        ])
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending"),
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "retrying"),
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "failed"),
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "suppressed"),
    ]);
  const [failedTypesRes, deliveredRecentRes, failedRecentRes] = await Promise.all([
    admin
      .from("notification_deliveries")
      .select("notification_type, last_error, created_at")
      .eq("organization_id", orgId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("notification_deliveries")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("notification_deliveries")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const pendingDeliveries = pendingRes.count ?? 0;
  const retryingDeliveries = retryingRes.count ?? 0;
  const failedDeliveries = failedRes.count ?? 0;
  const suppressedDeliveries = suppressedRes.count ?? 0;
  const retryQueueDepth = pendingDeliveries + retryingDeliveries;
  const deliveredRecent = deliveredRecentRes.data?.length ?? 0;
  const failedRecent = failedRecentRes.data?.length ?? 0;
  const deliverySuccessRateRecent =
    deliveredRecent + failedRecent === 0 ? 100 : (deliveredRecent / (deliveredRecent + failedRecent)) * 100;
  const webhookPending = (webhookRes.data ?? []).filter((d) => !d.delivered).length;
  const webhookHighAttempts = (webhookRes.data ?? []).filter((d) => Number(d.attempt_count ?? 0) >= 3).length;
  const failedReportRuns = (reportRunsRes.data ?? []).filter((r) => r.status === "failed").length;
  const lastRetryRunAt =
    (cronAuditRes.data ?? []).find((evt) => evt.action === "notifications.retry_deliveries_run")?.created_at ?? null;
  const referenceTimestamps = [
    (webhookRes.data ?? [])[0]?.created_at,
    (cronAuditRes.data ?? [])[0]?.created_at,
    (reportRunsRes.data ?? [])[0]?.started_at,
  ].filter((v): v is string => Boolean(v));
  const referenceMs =
    referenceTimestamps.length > 0
      ? Math.max(...referenceTimestamps.map((v) => new Date(v).getTime()).filter((ms) => Number.isFinite(ms)))
      : null;
  const retryRunAgeMinutes =
    lastRetryRunAt && referenceMs != null
      ? Math.max(0, Math.round((referenceMs - new Date(lastRetryRunAt).getTime()) / 60_000))
      : null;
  const alerts: string[] = [];
  if (retryQueueDepth >= 25) alerts.push(`Notification retry queue is elevated (${retryQueueDepth}).`);
  if (failedDeliveries >= 10) alerts.push(`High failed notification volume in recent samples (${failedDeliveries}).`);
  if (deliverySuccessRateRecent < 90) {
    alerts.push(`Recent notification delivery success rate is low (${deliverySuccessRateRecent.toFixed(1)}%).`);
  }
  if (lastRetryRunAt == null) alerts.push("Retry worker has no recorded heartbeat.");
  if (retryRunAgeMinutes != null && retryRunAgeMinutes > 30) {
    alerts.push(`Retry worker heartbeat appears stale (${retryRunAgeMinutes} minutes behind activity).`);
  }
  const failedTypeCounts = new Map<string, number>();
  const failureSignatureCounts = new Map<string, number>();
  for (const row of failedTypesRes.data ?? []) {
    const type = String(row.notification_type ?? "unknown");
    failedTypeCounts.set(type, (failedTypeCounts.get(type) ?? 0) + 1);
    const signature = String(row.last_error ?? "unknown")
      .replace(/^\[terminal\]\s*/i, "")
      .slice(0, 120);
    failureSignatureCounts.set(signature, (failureSignatureCounts.get(signature) ?? 0) + 1);
  }
  const topFailedTypes = [...failedTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topFailureSignatures = [...failureSignatureCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Admin</p>
        <h1 className="ui-display-title mt-2">System health transparency</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Operational status across notifications, webhook delivery retries, and report execution.
        </p>
      </header>

      {alerts.length > 0 && (
        <section className="ui-card border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Attention needed</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {alerts.map((alert) => (
              <li key={alert}>- {alert}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Notification retry queue</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{retryQueueDepth}</p>
          <p className="mt-1 text-xs text-zinc-500">
            pending {pendingDeliveries} · retrying {retryingDeliveries} · failed {failedDeliveries}
          </p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Notification failures</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{failedDeliveries}</p>
          <p className="mt-1 text-xs text-zinc-500">Retrying {retryingDeliveries} · suppressed {suppressedDeliveries}</p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Webhook backlog</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{webhookPending}</p>
          <p className="mt-1 text-xs text-zinc-500">{webhookHighAttempts} deliveries at 3+ attempts</p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Retry worker freshness</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {retryRunAgeMinutes == null ? "unknown" : `${retryRunAgeMinutes}m`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {lastRetryRunAt ? `Last run ${new Date(lastRetryRunAt).toISOString()}` : "No heartbeat recorded yet"}
          </p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Failed report runs</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{failedReportRuns}</p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivery success rate (recent)</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{deliverySuccessRateRecent.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-zinc-500">
            delivered {deliveredRecent} · failed {failedRecent}
          </p>
        </section>
        <section className="ui-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Failed deliveries (recent)</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{failedRecent}</p>
          <p className="mt-1 text-xs text-zinc-500">Operational dead-letter indicator</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Top failed notification types</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {topFailedTypes.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No failed delivery types.</li>
            ) : (
              topFailedTypes.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-700">{type}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Top failure signatures</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {topFailureSignatures.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No failure signatures.</li>
            ) : (
              topFailureSignatures.map(([signature, count]) => (
                <li key={signature} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="truncate text-zinc-700">{signature}</span>
                  <span className="font-semibold text-zinc-900">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">Recent operational events</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {(cronAuditRes.data ?? []).length === 0 ? (
            <li className="px-5 py-4 text-sm text-zinc-500">No recent events.</li>
          ) : (
            (cronAuditRes.data ?? []).map((evt, idx) => (
              <li key={`${evt.action}-${idx}`} className="px-5 py-3 text-sm">
                <p className="font-medium text-zinc-900">{evt.action}</p>
                <p className="text-xs text-zinc-500">{new Date(evt.created_at).toISOString()}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
