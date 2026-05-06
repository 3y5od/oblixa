import { AlertTriangle, Clock, FileWarning, Inbox, Percent, PlugZap } from "lucide-react";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

type FailedDeliveryRow = {
  id: string;
  type: string;
  kind: string;
  target: string;
  createdAt: string;
  error: string;
};

type AuditEventRow = {
  action: string;
  created_at: string;
};

type Props = {
  retryQueueDepth: number;
  pendingDeliveries: number;
  retryingDeliveries: number;
  failedDeliveries: number;
  suppressedDeliveries: number;
  webhookPending: number;
  webhookHighAttempts: number;
  retryRunAgeMinutes: number | null;
  lastRetryRunAt: string | null;
  reportSuccessRateRecent: number;
  reportRunsSucceededCount: number;
  reportRunsRunningCount: number;
  failedReportRuns: number;
  deliverySuccessRateRecent: number;
  deliveredRecent: number;
  failedRecent: number;
  latestSucceededReportAt: string | null;
  latestFailedReportAt: string | null;
  topFailedTypes: Array<[string, number]>;
  topFailureSignatures: Array<[string, number]>;
  recentFailedDeliveries: FailedDeliveryRow[];
  cronAuditEvents: AuditEventRow[];
};

export function SettingsHealthDiagnosticsSections(props: Props) {
  const {
    retryQueueDepth,
    pendingDeliveries,
    retryingDeliveries,
    failedDeliveries,
    suppressedDeliveries,
    webhookPending,
    webhookHighAttempts,
    retryRunAgeMinutes,
    lastRetryRunAt,
    reportSuccessRateRecent,
    reportRunsSucceededCount,
    reportRunsRunningCount,
    failedReportRuns,
    deliverySuccessRateRecent,
    deliveredRecent,
    failedRecent,
    latestSucceededReportAt,
    latestFailedReportAt,
    topFailedTypes,
    topFailureSignatures,
    recentFailedDeliveries,
    cronAuditEvents,
  } = props;

  return (
    <>
      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Throughput</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Delivery posture</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <OperationalSummaryCard eyebrow="Notifications" headline="Retry queue depth" tone={retryQueueDepth >= 25 ? "attention" : "healthy"} icon={Inbox} primaryValue={retryQueueDepth} primaryUnit="pending + retrying" breakdown={[{ label: "Pending", value: String(pendingDeliveries) }, { label: "Retrying", value: String(retryingDeliveries) }, { label: "Failed", value: String(failedDeliveries) }]} action={{ href: "/settings/operations", label: "Workspace operations" }} variant="compact" />
          <OperationalSummaryCard eyebrow="Notifications" headline="Failed deliveries" tone={failedDeliveries >= 10 ? "risk" : failedDeliveries > 0 ? "attention" : "healthy"} icon={AlertTriangle} primaryValue={failedDeliveries} primaryUnit="in sampled window" breakdown={[{ label: "Retrying", value: String(retryingDeliveries) }, { label: "Suppressed", value: String(suppressedDeliveries) }]} action={{ href: "/settings/health", label: "Refresh health" }} variant="compact" />
          <OperationalSummaryCard eyebrow="Webhooks" headline="Outbound backlog" tone={webhookPending > 0 || webhookHighAttempts > 0 ? "attention" : "healthy"} icon={PlugZap} primaryValue={webhookPending} primaryUnit="undelivered samples" breakdown={[{ label: "3+ attempts", value: String(webhookHighAttempts) }]} action={{ href: "/settings/operations", label: "Check integrations" }} variant="compact" />
          <OperationalSummaryCard eyebrow="Workers" headline="Retry worker lag" tone={retryRunAgeMinutes != null && retryRunAgeMinutes > 30 ? "risk" : lastRetryRunAt == null ? "attention" : "healthy"} icon={Clock} primaryValue={retryRunAgeMinutes == null ? null : `${retryRunAgeMinutes}m`} primaryFallback="Unknown" primaryUnit="behind latest activity" secondaryLine={lastRetryRunAt ? `Last run ${new Date(lastRetryRunAt).toISOString()}` : "No heartbeat recorded yet"} breakdown={retryRunAgeMinutes != null && lastRetryRunAt ? [{ label: "Last run", value: new Date(lastRetryRunAt).toISOString().slice(0, 19) }] : []} action={{ href: "/settings/health", label: "Review health" }} variant="compact" />
          <OperationalSummaryCard eyebrow="Reports" headline="Report run reliability" tone={failedReportRuns >= 3 ? "risk" : failedReportRuns > 0 ? "attention" : "healthy"} icon={FileWarning} primaryValue={`${reportSuccessRateRecent.toFixed(1)}%`} primaryUnit="successful runs in recent sample" breakdown={[{ label: "Succeeded", value: String(reportRunsSucceededCount) }, { label: "Running", value: String(reportRunsRunningCount) }, { label: "Failed", value: String(failedReportRuns) }]} action={{ href: "/contracts/reports", label: "Review report history" }} variant="compact" />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard eyebrow="Quality" headline="Delivery success (recent)" tone={deliverySuccessRateRecent < 90 ? "attention" : "healthy"} icon={Percent} primaryValue={`${deliverySuccessRateRecent.toFixed(1)}%`} primaryUnit="delivered vs failed sample" breakdown={[{ label: "Delivered", value: String(deliveredRecent) }, { label: "Failed", value: String(failedRecent) }]} action={{ href: "/settings/health", label: "Refresh metrics" }} variant="compact" />
        <OperationalSummaryCard eyebrow="Dead letter" headline="Recent failures" tone={failedRecent > 0 ? "attention" : "healthy"} icon={AlertTriangle} primaryValue={failedRecent} primaryUnit="failed in sample" action={{ href: "/settings/health", label: "Review breakdowns" }} variant="compact" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard eyebrow="Reports" headline="Latest successful digest" tone={latestSucceededReportAt ? "healthy" : failedReportRuns > 0 ? "attention" : "neutral"} icon={Clock} primaryValue={latestSucceededReportAt ? new Date(latestSucceededReportAt).toISOString().slice(0, 16) : null} primaryFallback="None sampled" primaryUnit="most recent successful report run" action={{ href: "/contracts/reports", label: "Review report history" }} variant="compact" />
        <OperationalSummaryCard eyebrow="Reports" headline="Latest failed digest" tone={latestFailedReportAt ? "attention" : "healthy"} icon={FileWarning} primaryValue={latestFailedReportAt ? new Date(latestFailedReportAt).toISOString().slice(0, 16) : null} primaryFallback="No recent failures" primaryUnit="most recent failed report run" action={{ href: "/contracts/reports", label: "Review report history" }} variant="compact" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-page-shell overflow-hidden">
          <div className="ui-surface-tint px-5 py-3">
            <p className="ui-eyebrow">Diagnostics</p>
            <h2 className="ui-section-title mt-1 text-base">Top failed notification types</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {topFailedTypes.length === 0 ? <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No failed delivery types.</li> : topFailedTypes.map(([type, count]) => <li key={type} className="flex items-center justify-between px-5 py-3 text-sm"><span className="text-[var(--text-secondary)]">{type}</span><span className="font-semibold text-[var(--text-primary)]">{count}</span></li>)}
          </ul>
        </section>
        <section className="ui-page-shell overflow-hidden">
          <div className="ui-surface-tint px-5 py-3">
            <p className="ui-eyebrow">Diagnostics</p>
            <h2 className="ui-section-title mt-1 text-base">Top failure signatures</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {topFailureSignatures.length === 0 ? <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No failure signatures.</li> : topFailureSignatures.map(([signature, count]) => <li key={signature} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span className="truncate text-[var(--text-secondary)]">{signature}</span><span className="font-semibold text-[var(--text-primary)]">{count}</span></li>)}
          </ul>
        </section>
      </div>

      <section className="ui-page-shell overflow-hidden">
        <div className="ui-surface-tint px-5 py-3">
          <p className="ui-eyebrow">Recovery</p>
          <h2 className="ui-section-title mt-1 text-base">Recent failed deliveries</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {recentFailedDeliveries.length === 0 ? <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No recent failed deliveries.</li> : recentFailedDeliveries.map((row) => <li key={row.id} className="space-y-1 px-5 py-4 text-sm"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-semibold text-[var(--text-primary)]">{row.type}</span><span className="text-[var(--text-tertiary)]">·</span><span className="text-[var(--text-secondary)]">{row.kind}</span><span className="text-[var(--text-tertiary)]">·</span><span className="text-[var(--text-secondary)]">{row.target}</span></div><p className="text-xs text-[var(--text-tertiary)]">{new Date(row.createdAt).toISOString()}</p><p className="text-xs text-[var(--text-secondary)]">{row.error}</p></li>)}
        </ul>
      </section>

      <section className="ui-page-shell overflow-hidden">
        <div className="ui-surface-tint px-5 py-3">
          <p className="ui-eyebrow">Audit</p>
          <h2 className="ui-section-title mt-1 text-base">Recent operational events</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {cronAuditEvents.length === 0 ? <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No recent events.</li> : cronAuditEvents.map((evt, idx) => <li key={`${evt.action}-${idx}`} className="px-5 py-3 text-sm"><p className="font-medium text-[var(--text-primary)]">{evt.action}</p><p className="text-xs text-[var(--text-tertiary)]">{new Date(evt.created_at).toISOString()}</p></li>)}
        </ul>
      </section>
    </>
  );
}