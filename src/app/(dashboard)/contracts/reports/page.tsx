import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, History, Layers, Mail, Package } from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  eligibleReportTypeOptionsForWorkspaceMode,
  loadProductSurfaceContext,
  workspaceModeAllowsReportType,
} from "@/lib/product-surface";
import {
  createReportPackAction,
  createReportPackSubscriptionAction,
  saveReportPackAnnotationsAction,
} from "@/actions/v4";

export default async function ReportsHistoryPage(props: {
  searchParams: Promise<{ runId?: string }>;
}) {
  if (!isFeatureEnabled("v3ReportingHistory")) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="ui-eyebrow">Feature flag</p>
        <h1 className="ui-display-title mt-2">Reports history is disabled</h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--text-tertiary)]">
          This surface is off because the server has disabled it (set{" "}
          <code className="text-xs">ENABLE_V3_REPORTING_HISTORY</code> to false, 0, no, or off). Remove or unset that
          variable to turn reporting history back on.
        </p>
      </div>
    );
  }
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { runId } = await props.searchParams;
  const { admin, orgId } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, ctx.role as WorkspaceRole);
  const workspaceMode = productSurface.mode;
  const eligibleReportTypes = eligibleReportTypeOptionsForWorkspaceMode(workspaceMode);

  const [
    { data: runs },
    { data: reportPacks },
    subsResult,
    { data: reportPackRuns },
  ] = await Promise.all([
    admin
      .from("report_runs")
      .select("id, report_mode, status, started_at, finished_at, error_summary, metrics_json")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(100),
    admin
      .from("report_packs")
      .select("id, name, report_type, schedule, active, updated_at, annotations_json")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(50),
    admin
      .from("report_pack_subscriptions")
      .select("id, report_pack_id, audience_label, schedule_cron, recipient_emails, active, last_sent_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("report_pack_runs")
      .select("id, report_pack_id, status, started_at, completed_at, metrics_json, output_refs_json, error, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const reportPackSubscriptionsRaw = subsResult.error ? [] : subsResult.data ?? [];
  const rawReportPacks = reportPacks ?? [];
  const visibleReportPacks = rawReportPacks.filter((p) =>
    workspaceModeAllowsReportType(workspaceMode, String((p as { report_type?: string }).report_type ?? ""))
  );
  const allowedPackIds = new Set(visibleReportPacks.map((p) => String((p as { id: string }).id)));
  const reportPackSubscriptions = reportPackSubscriptionsRaw.filter((s) =>
    allowedPackIds.has(String((s as { report_pack_id: string }).report_pack_id))
  );
  const packRunRowsAll = reportPackRuns ?? [];
  const packRunRows = packRunRowsAll.filter((r) =>
    allowedPackIds.has(String((r as { report_pack_id: string }).report_pack_id))
  );

  const runRows = runs ?? [];
  const failedDigestRuns = runRows.filter((r) => String(r.status).toLowerCase() === "failed").length;
  const failedPackRuns = packRunRows.filter((r) => String(r.status).toLowerCase() === "failed").length;

  if (workspaceMode === "core") redirect("/reports");

  const selectedRunId = runId || runs?.[0]?.id || null;
  const { data: recipients } = selectedRunId
    ? await admin
        .from("report_run_recipients")
        .select("id, recipient_email, delivery_status, delivered_at, opened_at, clicked_at, delivery_error")
        .eq("report_run_id", selectedRunId)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as Array<Record<string, unknown>> };

  async function createReportPackFormAction(formData: FormData) {
    "use server";
    await createReportPackAction(formData);
  }

  async function saveAnnotationsFormAction(formData: FormData) {
    "use server";
    await saveReportPackAnnotationsAction(formData);
  }

  async function createSubscriptionFormAction(formData: FormData) {
    "use server";
    await createReportPackSubscriptionAction(formData);
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        icon={<History className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Reporting"
        title="Digest run history"
        lead="Review report runs and recipient delivery/open/click engagement."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OperationalSummaryCard
          eyebrow="Digest"
          headline="Email digest runs"
          tone={failedDigestRuns > 0 ? "attention" : "healthy"}
          icon={Activity}
          primaryValue={runRows.length}
          breakdown={[
            { label: "Failed", value: String(failedDigestRuns) },
            { label: "Selected", value: selectedRunId ? "Yes" : "—" },
          ]}
          action={{ href: "#digest-runs", label: "Review digest runs" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Catalog"
          headline="Report packs"
          tone={visibleReportPacks.length > 0 ? "neutral" : "attention"}
          icon={Package}
          primaryValue={visibleReportPacks.length}
          breakdown={[{ label: "Active", value: String(visibleReportPacks.filter((p) => p.active).length) }]}
          action={{ href: "#report-packs", label: "Manage packs" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Delivery"
          headline="Subscriptions"
          tone={reportPackSubscriptions.length > 0 ? "healthy" : "neutral"}
          icon={Mail}
          primaryValue={reportPackSubscriptions.length}
          breakdown={[
            {
              label: "Active",
              value: String(reportPackSubscriptions.filter((s) => s.active).length),
            },
          ]}
          action={{ href: "#subscriptions", label: "Review subscriptions" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Automation"
          headline="Pack run history"
          tone={failedPackRuns > 0 ? "attention" : "healthy"}
          icon={Layers}
          primaryValue={packRunRows.length}
          breakdown={[{ label: "Failed", value: String(failedPackRuns) }]}
          action={{ href: "#pack-runs", label: "Review pack runs" }}
          variant="compact"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section id="report-packs" className="ui-page-shell scroll-mt-8 overflow-hidden lg:col-span-2">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
            <p className="ui-eyebrow">Configure</p>
            <h2 className="ui-section-title mt-1 text-base">Create report pack</h2>
            <p className="ui-support-copy mt-1">Create, annotate, and schedule report packs from the same control surface that shows downstream run history and delivery state.</p>
          </div>
          <form action={createReportPackFormAction} className="grid gap-2 border-b border-[var(--border-subtle)] px-5 py-4 md:grid-cols-2">
            <input aria-label="Weekly execution health" name="name" required placeholder="Weekly execution health" className="ui-input" />
            <select
              name="reportType"
              className="ui-input"
              defaultValue={eligibleReportTypes[0] ?? "weekly_execution_health"}
            >
              {eligibleReportTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input aria-label="15 * * * * (UTC minute hour …) — empty = every cron run" name="schedule" placeholder="15 * * * * (UTC minute hour …) — empty = every cron run" className="ui-input" />
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] md:col-span-2">
              <input aria-label="Emit webhooks" type="checkbox" name="emitWebhooks" className="ui-checkbox" />
              Emit <code className="text-[11px]">report_pack.generated</code> webhook when a run is recorded
            </label>
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-xs">
              Create report pack
            </button>
          </form>
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
            <p className="ui-eyebrow">Library</p>
            <h2 className="ui-section-title mt-1 text-base">Report packs</h2>
          </div>
          {visibleReportPacks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[var(--text-tertiary)]">
              No report packs yet. Create one using `POST /api/report-packs`.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {visibleReportPacks.map((pack) => (
                <li key={pack.id} className="space-y-2 px-5 py-3 text-sm text-[var(--text-secondary)]">
                  <p className="font-semibold text-[var(--text-primary)]">{pack.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {pack.report_type} · {pack.active ? "active" : "inactive"}
                    {pack.schedule ? ` · schedule ${pack.schedule}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={`/api/report-packs/${pack.id}/runs`} className="ui-link">
                      JSON runs
                    </Link>
                    <ExternalLink
                      href={`/api/report-packs/${pack.id}/runs?format=csv`}
                      className="ui-link"
                    >
                      Latest CSV
                    </ExternalLink>
                    <ExternalLink
                      href={`/api/report-packs/${pack.id}/runs?format=html`}
                      className="ui-link"
                    >
                      Print / PDF-ready HTML
                    </ExternalLink>
                    <ExternalLink
                      href={`/api/report-packs/${pack.id}/runs?format=pdf`}
                      className="ui-link"
                    >
                      PDF-ready (same HTML)
                    </ExternalLink>
                  </div>
                  <form action={saveAnnotationsFormAction} className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
                    <input type="hidden" name="reportPackId" value={pack.id} />
                    <label className="text-[11px] font-medium text-[var(--text-secondary)]">Annotations (JSON array)</label>
                    <textarea
                      name="annotationsJson"
                      rows={3}
                      defaultValue={JSON.stringify(
                        (pack as { annotations_json?: unknown }).annotations_json ?? [],
                        null,
                        2
                      )}
                      className="ui-input font-mono text-[11px]"
                    />
                    <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                      Save annotations
                    </button>
                  </form>
                  <form action={createSubscriptionFormAction} className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
                    <input type="hidden" name="reportPackId" value={pack.id} />
                    <p className="text-[11px] font-medium text-[var(--text-secondary)]">New subscription</p>
                    <input aria-label="Audience label" name="audienceLabel" placeholder="Audience label" className="ui-input text-[11px]" />
                    <input aria-label="Cron e.g. 0 9 * * MON" name="scheduleCron" placeholder="Cron e.g. 0 9 * * MON" className="ui-input text-[11px]" />
                    <input aria-label="emails comma-separated" name="recipientEmails"
                      placeholder="emails comma-separated"
                      className="ui-input text-[11px]"
                    />
                    <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                      Add subscription
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="subscriptions" className="ui-page-shell scroll-mt-8 overflow-hidden lg:col-span-2">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
            <p className="ui-eyebrow">Routing</p>
            <h2 className="ui-section-title mt-1 text-base">Report pack subscriptions</h2>
            <p className="ui-support-copy mt-1">Keep recipient routing and cadence visible beside the pack catalog so delivery setup does not drift from report design.</p>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {reportPackSubscriptions.length === 0 ? (
              <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No subscriptions yet.</li>
            ) : (
              reportPackSubscriptions.map((sub) => (
                <li key={sub.id} className="px-5 py-3 text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{sub.audience_label}</span> · pack{" "}
                  {sub.report_pack_id}
                  <span className="text-[var(--text-tertiary)]">
                    {" "}
                    · {(sub.recipient_emails as string[] | null)?.join(", ") || "no emails"}
                    {sub.schedule_cron ? ` · ${sub.schedule_cron}` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section id="pack-runs" className="ui-page-shell scroll-mt-8 overflow-hidden lg:col-span-2">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
            <p className="ui-eyebrow">Executions</p>
            <h2 className="ui-section-title mt-1 text-base">Report pack run history</h2>
            <p className="ui-support-copy mt-1">Use run history as the diagnostic layer for failed packs, generated outputs, and delivery coverage.</p>
          </div>
          {(reportPackRuns ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No report pack runs yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {(reportPackRuns ?? []).map((run) => (
                <li key={run.id} className="px-5 py-3 text-sm">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {run.report_pack_id} · {run.status}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {new Date(run.created_at).toLocaleString()}
                    {run.completed_at ? ` · completed ${new Date(run.completed_at).toLocaleString()}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    <ExternalLink
                      className="ui-link"
                      href={`/api/report-packs/${run.report_pack_id}/runs?format=csv&runId=${run.id}`}
                    >
                      CSV
                    </ExternalLink>
                    <ExternalLink
                      className="ui-link"
                      href={`/api/report-packs/${run.report_pack_id}/runs?format=html&runId=${run.id}`}
                    >
                      HTML
                    </ExternalLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="digest-runs" className="ui-card scroll-mt-8 overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
            <p className="ui-eyebrow">Timeline</p>
            <h2 className="ui-section-title mt-1 text-base">Digest runs</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {(runs ?? []).map((run) => (
              <li key={run.id} className="px-5 py-3 text-sm">
                <Link
                  href={`/contracts/reports?runId=${run.id}`}
                  className={`block rounded-lg border px-3 py-2 ${
                    selectedRunId === run.id
                      ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-white"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]"
                  }`}
                >
                  <p className="font-semibold">
                    {run.report_mode} · {run.status}
                  </p>
                  <p className={`text-xs ${selectedRunId === run.id ? "text-[var(--text-tertiary)]" : "text-[var(--text-tertiary)]"}`}>
                    {new Date(run.started_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
            <p className="ui-eyebrow">Engagement</p>
            <h2 className="ui-section-title mt-1 text-base">Recipients</h2>
          </div>
          {selectedRunId ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {(recipients ?? []).map((recipient) => (
                <li key={String(recipient.id)} className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                  <p className="font-semibold">{String(recipient.recipient_email)}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {String(recipient.delivery_status)}
                    {(recipient.delivered_at as string | null)
                      ? ` · delivered ${new Date(String(recipient.delivered_at)).toLocaleString()}`
                      : ""}
                    {(recipient.opened_at as string | null)
                      ? ` · opened ${new Date(String(recipient.opened_at)).toLocaleString()}`
                      : ""}
                    {(recipient.clicked_at as string | null)
                      ? ` · clicked ${new Date(String(recipient.clicked_at)).toLocaleString()}`
                      : ""}
                  </p>
                  {(recipient.delivery_error as string | null) ? (
                    <p className="ui-alert-error mt-2 text-xs" role="alert">
                      {String(recipient.delivery_error)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No runs yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
