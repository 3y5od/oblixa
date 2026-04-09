import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function ReportsHistoryPage(props: {
  searchParams: Promise<{ runId?: string }>;
}) {
  if (!isFeatureEnabled("v3ReportingHistory")) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="ui-eyebrow">Feature flag</p>
        <h1 className="ui-display-title mt-2">Reports history is disabled</h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
          Enable `ENABLE_V3_REPORTING_HISTORY` to review digest runs and recipient engagement.
        </p>
      </div>
    );
  }
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { runId } = await props.searchParams;
  const { admin, orgId } = ctx;
  const { data: runs } = await admin
    .from("report_runs")
    .select("id, report_mode, status, started_at, finished_at, error_summary, metrics_json")
    .eq("organization_id", orgId)
    .order("started_at", { ascending: false })
    .limit(100);
  const selectedRunId = runId || runs?.[0]?.id || null;
  const { data: recipients } = selectedRunId
    ? await admin
        .from("report_run_recipients")
        .select("id, recipient_email, delivery_status, delivered_at, opened_at, clicked_at, delivery_error")
        .eq("report_run_id", selectedRunId)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as Array<Record<string, unknown>> };

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Reporting</p>
        <h1 className="ui-display-title mt-2">Digest run history</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Review report runs and recipient delivery/open/click engagement.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Runs</h2>
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
            <h2 className="text-sm font-semibold text-zinc-800">Recipients</h2>
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
