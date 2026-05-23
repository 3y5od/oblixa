import { Database } from "lucide-react";
import {
  formatIsoMinute,
  formatPercentOrNoSample,
  formatSampleDetail,
} from "@/lib/workspace-health-model";

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
  reportSuccessRateRecent: number | null;
  reportRunsSucceededCount: number;
  reportRunsRunningCount: number;
  failedReportRuns: number;
  deliverySuccessRateRecent: number | null;
  deliveredRecent: number;
  failedRecent: number;
  latestSucceededReportAt: string | null;
  latestFailedReportAt: string | null;
  topFailedTypes: Array<[string, number]>;
  topFailureSignatures: Array<[string, number]>;
  recentFailedDeliveries: FailedDeliveryRow[];
  cronAuditEvents: AuditEventRow[];
};

type DiagnosticTone = "neutral" | "healthy" | "attention" | "risk";

function supportCellClass(tone: DiagnosticTone): string {
  const base =
    "rounded-lg border border-l-[0.2rem] bg-[color:color-mix(in_oklab,var(--surface)_94%,white)] px-3 py-2";
  if (tone === "healthy") {
    return `${base} border-[color:var(--border-card)] border-l-[color:var(--success-ink)]`;
  }
  if (tone === "attention") {
    return `${base} border-[color:var(--border-card)] border-l-[color:var(--warning-ink)]`;
  }
  if (tone === "risk") {
    return `${base} border-[color:var(--border-card)] border-l-[color:var(--danger-ink)]`;
  }
  return `${base} border-[color:var(--border-card)] border-l-[color:var(--border-contrast)]`;
}

function supportDotClass(tone: DiagnosticTone): string {
  if (tone === "healthy") return "text-[var(--success-ink)]";
  if (tone === "attention") return "text-[var(--warning-ink)]";
  if (tone === "risk") return "text-[var(--danger-ink)]";
  return "text-[var(--text-tertiary)]";
}

function supportMeterClass(tone: DiagnosticTone): string {
  if (tone === "healthy") return "bg-[var(--success-ink)]";
  if (tone === "attention") return "bg-[var(--warning-ink)]";
  if (tone === "risk") return "bg-[var(--danger-ink)]";
  return "bg-[var(--border-contrast)]";
}

function SupportSampleTrack({
  value,
  label,
  tone,
}: {
  value: number | null;
  label: string;
  tone: DiagnosticTone;
}) {
  const width = value == null ? 0 : Math.max(4, Math.min(100, Math.round(value)));

  return (
    <div className="mt-3">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_64%,transparent)]"
        aria-label={label}
        role="img"
      >
        {width > 0 ? (
          <span className={`block h-full rounded-full ${supportMeterClass(tone)}`} style={{ width: `${width}%` }} />
        ) : null}
      </div>
      <p className="mt-1 text-[11px] font-medium text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

function SupportDiagnosticCell({
  label,
  value,
  detail,
  tone,
  meter,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: DiagnosticTone;
  meter?: {
    value: number | null;
    label: string;
  };
}) {
  return (
    <article className={supportCellClass(tone)}>
      <div className="flex items-center gap-2">
        <span className={`text-xs leading-none ${supportDotClass(tone)}`} aria-hidden>
          ●
        </span>
        <p className="ui-kicker">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p> : null}
      {meter ? <SupportSampleTrack value={meter.value} label={meter.label} tone={tone} /> : null}
    </article>
  );
}

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
  const deliveryRateLabel = formatPercentOrNoSample(deliverySuccessRateRecent, "No deliveries sampled");
  const reportRateLabel = formatPercentOrNoSample(reportSuccessRateRecent, "No report runs sampled");
  const latestSucceededReport = formatIsoMinute(latestSucceededReportAt) ?? "None sampled";
  const latestFailedReport = formatIsoMinute(latestFailedReportAt) ?? "No recent failures";
  const lastRecoveryRun = formatIsoMinute(lastRetryRunAt) ?? "No recovery heartbeat recorded";
  const hasRetryQueueState = retryQueueDepth > 0 || failedDeliveries > 0 || suppressedDeliveries > 0;
  const hasWebhookBacklog = webhookPending > 0 || webhookHighAttempts > 0;
  const hasDeliverySample = deliverySuccessRateRecent != null;
  const hasReportState =
    reportSuccessRateRecent != null ||
    reportRunsRunningCount > 0 ||
    failedReportRuns > 0 ||
    latestSucceededReportAt != null ||
    latestFailedReportAt != null;
  const hasDiagnosticCollections =
    topFailedTypes.length > 0 ||
    topFailureSignatures.length > 0 ||
    recentFailedDeliveries.length > 0 ||
    cronAuditEvents.length > 0;
  const recoveryTone: DiagnosticTone =
    lastRetryRunAt == null
      ? "neutral"
      : retryRunAgeMinutes != null && retryRunAgeMinutes > 30
        ? "risk"
        : "healthy";
  const deliveryTone: DiagnosticTone =
    failedRecent > 0 || failedDeliveries > 0 ? "attention" : hasDeliverySample ? "healthy" : "neutral";
  const reportTone: DiagnosticTone =
    failedReportRuns > 0 || latestFailedReportAt != null
      ? "attention"
      : reportSuccessRateRecent != null
        ? "healthy"
        : "neutral";
  const operationalEventsTone: DiagnosticTone = hasDiagnosticCollections ? "attention" : "neutral";

  const hasAnySample =
    hasRetryQueueState ||
    hasWebhookBacklog ||
    hasDeliverySample ||
    hasReportState ||
    hasDiagnosticCollections ||
    lastRetryRunAt != null;

  if (!hasAnySample) {
    return (
      <div className="flex items-start gap-4 py-6">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_32%,var(--surface-raised))] text-[var(--accent-strong)]"
          aria-hidden
        >
          <Database className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p>
            <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Awaiting traffic
            </span>
          </p>
          <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            No diagnostics sampled yet
          </p>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Recovery worker, delivery, and report samples will appear here once the workspace receives traffic and the recovery worker runs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-2">
        <SupportDiagnosticCell
          label="Recovery worker"
          value={
            lastRetryRunAt == null
              ? "No recovery heartbeat recorded"
              : retryRunAgeMinutes == null
                ? "Recovery activity recorded"
                : `${retryRunAgeMinutes}m behind latest activity`
          }
          detail={`Last recorded run: ${lastRecoveryRun}.`}
          tone={recoveryTone}
        />
        {hasRetryQueueState ? (
          <SupportDiagnosticCell
            label="Retry queue"
            value={`${retryQueueDepth} pending or retrying`}
            detail={`Pending: ${pendingDeliveries}. Retrying: ${retryingDeliveries}. Failed: ${failedDeliveries}. Suppressed: ${suppressedDeliveries}.`}
            tone={failedDeliveries > 0 ? "attention" : "neutral"}
          />
        ) : null}
        {hasWebhookBacklog ? (
          <SupportDiagnosticCell
            label="Outbound backlog"
            value={`${webhookPending} undelivered samples`}
            detail={`${webhookHighAttempts} sampled webhook deliver${webhookHighAttempts === 1 ? "y" : "ies"} needed 3+ attempts.`}
            tone="attention"
          />
        ) : null}
        <SupportDiagnosticCell
          label="Delivery sample"
          value={hasDeliverySample ? deliveryRateLabel : "No deliveries sampled"}
          detail={
            hasDeliverySample
              ? `${formatSampleDetail(deliveredRecent, failedRecent, "delivery")}.`
              : "No delivery success rate is shown until delivered or failed messages are sampled."
          }
          tone={deliveryTone}
          meter={{
            value: deliverySuccessRateRecent,
            label: hasDeliverySample ? "Delivered share in sample" : "Awaiting delivery sample",
          }}
        />
        <SupportDiagnosticCell
          label="Report sample"
          value={reportRateLabel}
          detail={
            reportSuccessRateRecent == null
              ? "No report runs sampled in recent activity."
              : `${formatSampleDetail(reportRunsSucceededCount, failedReportRuns, "report run")}. Running: ${reportRunsRunningCount}.`
          }
          tone={reportTone}
          meter={{
            value: reportSuccessRateRecent,
            label: reportSuccessRateRecent == null ? "Awaiting report sample" : "Succeeded share in sample",
          }}
        />
        {hasReportState && latestSucceededReportAt != null ? (
          <SupportDiagnosticCell
            label="Latest successful report"
            value={latestSucceededReport}
            detail="Most recent successful report run."
            tone="healthy"
          />
        ) : null}
        {latestFailedReportAt != null || failedReportRuns > 0 ? (
          <SupportDiagnosticCell
            label="Latest failed report"
            value={latestFailedReport}
            detail="Most recent failed report run."
            tone="attention"
          />
        ) : null}
        <SupportDiagnosticCell
          label="Operational events"
          value={cronAuditEvents.length > 0 ? `${cronAuditEvents.length} recent` : "No recent events"}
          detail={
            hasDiagnosticCollections
              ? "Recent failures or events are listed below."
              : "No recent delivery failures or operational events."
          }
          tone={operationalEventsTone}
        />
      </div>

      {topFailedTypes.length > 0 ? (
        <section className="max-w-3xl space-y-2">
          <h2 className="ui-section-title text-base">Failed delivery recovery</h2>
          <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {topFailedTypes.map(([type, count]) => (
              <li key={type} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-[var(--text-secondary)]">{type}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topFailureSignatures.length > 0 ? (
        <section className="max-w-3xl space-y-2">
          <h2 className="ui-section-title text-base">Failure signatures</h2>
          <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {topFailureSignatures.map(([signature, count]) => (
              <li key={signature} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-[var(--text-secondary)]">{signature}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recentFailedDeliveries.length > 0 ? (
        <section className="max-w-3xl space-y-2">
          <h2 className="ui-section-title text-base">Recent failed deliveries</h2>
          <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {recentFailedDeliveries.map((row) => (
              <li key={row.id} className="space-y-1 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-[var(--text-primary)]">{row.type}</span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span className="text-[var(--text-secondary)]">{row.kind}</span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span className="text-[var(--text-secondary)]">{row.target}</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">{formatIsoMinute(row.createdAt) ?? row.createdAt}</p>
                <p className="text-xs text-[var(--text-secondary)]">{row.error}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cronAuditEvents.length > 0 ? (
        <section id="recent-operational-events" className="max-w-3xl scroll-mt-8 space-y-2">
          <h2 className="ui-section-title text-base">Recent operational events</h2>
          <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {cronAuditEvents.map((evt, idx) => (
              <li key={`${evt.action}-${idx}`} className="py-2 text-sm">
                <p className="font-medium text-[var(--text-primary)]">{evt.action}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{formatIsoMinute(evt.created_at) ?? evt.created_at}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
