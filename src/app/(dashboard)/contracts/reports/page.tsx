import Link from "next/link";
import { Activity, Layers, Mail, Package } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
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
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
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
  const reportPackSubscriptions = subsResult.error ? [] : subsResult.data ?? [];
  const selectedRunId = runId || runs?.[0]?.id || null;
  const runRows = runs ?? [];
  const failedDigestRuns = runRows.filter((r) => String(r.status).toLowerCase() === "failed").length;
  const packRunRows = reportPackRuns ?? [];
  const failedPackRuns = packRunRows.filter((r) => String(r.status).toLowerCase() === "failed").length;
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
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Reporting</p>
        <h1 className="ui-display-title mt-2">Digest run history</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Review report runs and recipient delivery/open/click engagement.
        </p>
      </header>
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
          action={{ href: "#digest-runs", label: "Open run list" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Catalog"
          headline="V4 report packs"
          tone={(reportPacks ?? []).length > 0 ? "neutral" : "attention"}
          icon={Package}
          primaryValue={(reportPacks ?? []).length}
          breakdown={[{ label: "Active", value: String((reportPacks ?? []).filter((p) => p.active).length) }]}
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
          action={{ href: "#pack-runs", label: "Open pack runs" }}
          variant="compact"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section id="report-packs" className="ui-card overflow-hidden lg:col-span-2">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Configure</p>
            <h2 className="ui-section-title mt-1 text-base">Create V4 report pack</h2>
          </div>
          <form action={createReportPackFormAction} className="grid gap-2 border-b border-zinc-100 px-5 py-4 md:grid-cols-2">
            <input name="name" required placeholder="Weekly execution health" className="ui-input" />
            <input name="reportType" defaultValue="weekly_execution_health" className="ui-input" />
            <input name="schedule" placeholder="15 * * * * (UTC minute hour …) — empty = every cron run" className="ui-input" />
            <label className="flex items-center gap-2 text-xs text-zinc-600 md:col-span-2">
              <input type="checkbox" name="emitWebhooks" className="rounded border-zinc-300" />
              Emit <code className="text-[10px]">report_pack.generated</code> webhook when a run is recorded
            </label>
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-xs">
              Create report pack
            </button>
          </form>
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Library</p>
            <h2 className="ui-section-title mt-1 text-base">V4 report packs</h2>
          </div>
          {(reportPacks ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-zinc-500">
              No report packs yet. Create one using `POST /api/report-packs`.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(reportPacks ?? []).map((pack) => (
                <li key={pack.id} className="space-y-2 px-5 py-3 text-sm text-zinc-700">
                  <p className="font-semibold text-zinc-900">{pack.name}</p>
                  <p className="text-xs text-zinc-500">
                    {pack.report_type} · {pack.active ? "active" : "inactive"}
                    {pack.schedule ? ` · schedule ${pack.schedule}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={`/api/report-packs/${pack.id}/runs`} className="ui-link">
                      JSON runs
                    </Link>
                    <a
                      href={`/api/report-packs/${pack.id}/runs?format=csv`}
                      className="ui-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Latest CSV
                    </a>
                    <a
                      href={`/api/report-packs/${pack.id}/runs?format=html`}
                      className="ui-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Print / PDF-ready HTML
                    </a>
                    <a
                      href={`/api/report-packs/${pack.id}/runs?format=pdf`}
                      className="ui-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF-ready (same HTML)
                    </a>
                  </div>
                  <form action={saveAnnotationsFormAction} className="space-y-1 border-t border-zinc-100 pt-2">
                    <input type="hidden" name="reportPackId" value={pack.id} />
                    <label className="text-[11px] font-medium text-zinc-600">Annotations (JSON array)</label>
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
                  <form action={createSubscriptionFormAction} className="space-y-1 border-t border-zinc-100 pt-2">
                    <input type="hidden" name="reportPackId" value={pack.id} />
                    <p className="text-[11px] font-medium text-zinc-600">New subscription</p>
                    <input name="audienceLabel" placeholder="Audience label" className="ui-input text-[11px]" />
                    <input name="scheduleCron" placeholder="Cron e.g. 0 9 * * MON" className="ui-input text-[11px]" />
                    <input
                      name="recipientEmails"
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
        <section id="subscriptions" className="ui-card overflow-hidden lg:col-span-2">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Routing</p>
            <h2 className="ui-section-title mt-1 text-base">Report pack subscriptions</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {reportPackSubscriptions.length === 0 ? (
              <li className="px-5 py-4 text-sm text-zinc-500">No subscriptions yet.</li>
            ) : (
              reportPackSubscriptions.map((sub) => (
                <li key={sub.id} className="px-5 py-3 text-xs text-zinc-700">
                  <span className="font-medium text-zinc-900">{sub.audience_label}</span> · pack{" "}
                  {sub.report_pack_id}
                  <span className="text-zinc-500">
                    {" "}
                    · {(sub.recipient_emails as string[] | null)?.join(", ") || "no emails"}
                    {sub.schedule_cron ? ` · ${sub.schedule_cron}` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section id="pack-runs" className="ui-card overflow-hidden lg:col-span-2">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Executions</p>
            <h2 className="ui-section-title mt-1 text-base">V4 report pack run history</h2>
          </div>
          {(reportPackRuns ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-zinc-500">No V4 report pack runs yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(reportPackRuns ?? []).map((run) => (
                <li key={run.id} className="px-5 py-3 text-sm">
                  <p className="font-semibold text-zinc-900">
                    {run.report_pack_id} · {run.status}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(run.created_at).toLocaleString()}
                    {run.completed_at ? ` · completed ${new Date(run.completed_at).toLocaleString()}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    <a
                      className="ui-link"
                      href={`/api/report-packs/${run.report_pack_id}/runs?format=csv&runId=${run.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      CSV
                    </a>
                    <a
                      className="ui-link"
                      href={`/api/report-packs/${run.report_pack_id}/runs?format=html&runId=${run.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      HTML
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="digest-runs" className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Timeline</p>
            <h2 className="ui-section-title mt-1 text-base">Digest runs</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {(runs ?? []).map((run) => (
              <li key={run.id} className="px-5 py-3 text-sm">
                <Link
                  href={`/contracts/reports?runId=${run.id}`}
                  className={`block rounded-lg border px-3 py-2 ${
                    selectedRunId === run.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <p className="font-semibold">
                    {run.report_mode} · {run.status}
                  </p>
                  <p className={`text-xs ${selectedRunId === run.id ? "text-zinc-300" : "text-zinc-500"}`}>
                    {new Date(run.started_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <p className="ui-eyebrow">Engagement</p>
            <h2 className="ui-section-title mt-1 text-base">Recipients</h2>
          </div>
          {selectedRunId ? (
            <ul className="divide-y divide-zinc-100">
              {(recipients ?? []).map((recipient) => (
                <li key={String(recipient.id)} className="px-5 py-3 text-sm text-zinc-700">
                  <p className="font-semibold">{String(recipient.recipient_email)}</p>
                  <p className="text-xs text-zinc-500">
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
                    <p className="mt-1 text-xs text-rose-700">{String(recipient.delivery_error)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-zinc-500">No runs yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
