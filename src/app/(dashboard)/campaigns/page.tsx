import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  CAMPAIGN_TYPE_LABELS,
  isValidCampaignType,
  type CampaignType,
} from "@/lib/v5/campaign-types";
import { CampaignSimulationPromote } from "@/components/campaigns/campaign-simulation-promote";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { SIMULATION_TYPE_FOCUS, type SimulationType } from "@/lib/v5/simulation-types";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5PortfolioCampaigns");

  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status.trim() : "";
  const typeFilter = typeof sp.type === "string" ? sp.type.trim() : "";
  const allowedStatus = new Set(["draft", "previewed", "active", "paused", "closed"]);
  const statusOk = !statusFilter || allowedStatus.has(statusFilter);
  const typeOk = !typeFilter || isValidCampaignType(typeFilter);

  const { admin, orgId } = ctx;
  const simOn = isFeatureEnabled("v5SimulationAndIntelligence");

  const [{ data: campaigns }, simQueries] = await Promise.all([
    admin
      .from("portfolio_campaigns")
      .select("id, name, campaign_type, status, preview_summary_json, progress_summary_json, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(200),
    simOn
      ? Promise.all([
          admin
            .from("change_simulations")
            .select("id, name, simulation_type, updated_at, latest_run_id")
            .eq("organization_id", orgId)
            .order("updated_at", { ascending: false })
            .limit(25),
          admin
            .from("change_simulation_runs")
            .select("id, simulation_id, created_at, promoted_campaign_id")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(30),
        ])
      : Promise.resolve(null),
  ]);

  const simulations = simQueries?.[0]?.data ?? null;
  const simRuns = simQueries?.[1]?.data ?? null;

  const filteredCampaigns = (campaigns ?? []).filter((c) => {
    if (statusFilter && statusOk && c.status !== statusFilter) return false;
    if (typeFilter && typeOk && c.campaign_type !== typeFilter) return false;
    return true;
  });
  const activeCount = filteredCampaigns.filter((c) => c.status === "active").length;
  const pausedCount = filteredCampaigns.filter((c) => c.status === "paused").length;
  const totalProcessed = filteredCampaigns.reduce((sum, c) => {
    const progress = (c.progress_summary_json ?? {}) as Record<string, unknown>;
    return sum + Number(progress.processed ?? 0);
  }, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Portfolio change management</p>
          <h1 className="ui-display-title mt-2">Campaign center</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Track change rollouts across many contracts with preview, owner accountability, and progress visibility.
            {statusFilter || typeFilter ? (
              <span className="mt-2 block text-sm text-zinc-600">
                {statusFilter && statusOk ? (
                  <>
                    Filtered by status <code className="rounded bg-zinc-100 px-1">{statusFilter}</code>
                    {!typeFilter ? ". " : " · "}
                  </>
                ) : null}
                {statusFilter && !statusOk ? (
                  <span className="text-rose-700">Unknown status filter (ignored). </span>
                ) : null}
                {typeFilter && typeOk ? (
                  <>
                    Type <code className="rounded bg-zinc-100 px-1">{typeFilter}</code>.{" "}
                  </>
                ) : null}
                {typeFilter && !typeOk ? (
                  <span className="text-rose-700">Unknown campaign type filter (ignored). </span>
                ) : null}
                <Link href="/campaigns" className="ui-link">
                  Clear filters
                </Link>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/api/campaigns" className="ui-btn-secondary px-4 py-2.5 text-[13px]" target="_blank">
            Open campaigns API
          </Link>
          <Link href="/api/intelligence/portfolio-signals" className="ui-btn-ghost px-4 py-2.5 text-[13px]" target="_blank">
            Portfolio signals
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="ui-card p-4">
          <p className="ui-label-caps">Active campaigns</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{activeCount}</p>
        </article>
        <article className="ui-card p-4">
          <p className="ui-label-caps">Paused campaigns</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{pausedCount}</p>
        </article>
        <article className="ui-card p-4">
          <p className="ui-label-caps">Contracts processed</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{totalProcessed}</p>
          <p className="mt-1 text-xs text-zinc-500">Across filtered campaign set.</p>
        </article>
      </section>

      {simOn ? (
        <section id="simulations" className="scroll-mt-8 space-y-6">
          <div>
            <h2 className="ui-section-title text-lg">Change simulation studio</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Recent simulations and runs (§9.6), including promotion readiness and scenario context.
            </p>
          </div>
          <details className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-800">Simulation types</summary>
            <ul className="mt-3 space-y-2 text-xs">
              {(Object.keys(SIMULATION_TYPE_FOCUS) as SimulationType[]).map((k) => (
                <li key={k}>
                  <code className="rounded bg-zinc-100 px-1">{k}</code> — {SIMULATION_TYPE_FOCUS[k]}
                </li>
              ))}
            </ul>
          </details>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="ui-card p-5">
              <p className="ui-label-caps">Saved simulations</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-700">
                {(simulations ?? []).length === 0 ? (
                  <li className="text-zinc-500">No simulations yet.</li>
                ) : (
                  (simulations ?? []).map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0">
                      <span className="font-medium text-zinc-900">{s.name}</span>
                      <span className="font-mono text-[11px] text-zinc-500">{s.simulation_type}</span>
                      <Link
                        href={`/api/simulations/${s.id}`}
                        className="ui-link text-xs"
                        target="_blank"
                        rel="noreferrer"
                      >
                        API
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </article>
            <article className="ui-card p-5">
              <p className="ui-label-caps">Recent runs</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-zinc-700">
                {(simRuns ?? []).length === 0 ? (
                  <li className="text-zinc-500">No runs yet.</li>
                ) : (
                  (simRuns ?? []).map((r) => (
                    <li key={r.id} className="border-b border-zinc-100 pb-2 text-xs last:border-0">
                      <span className="font-mono text-zinc-600">{r.id.slice(0, 8)}…</span> · sim{" "}
                      <span className="font-mono">{r.simulation_id.slice(0, 8)}…</span>
                      {r.promoted_campaign_id ? (
                        <>
                          {" "}
                          · promoted →{" "}
                          <Link href={`/campaigns/${r.promoted_campaign_id}`} className="ui-link">
                            campaign
                          </Link>
                        </>
                      ) : null}
                      <div className="mt-1">
                        <Link
                          href={`/api/simulations/${r.simulation_id}`}
                          className="ui-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open simulation JSON
                        </Link>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">Promote to campaign</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Create a draft portfolio campaign from a completed simulation context.
            </p>
            <div className="mt-4">
              <CampaignSimulationPromote />
            </div>
          </div>
        </section>
      ) : (
        <section id="simulations" className="scroll-mt-8">
          <h2 className="ui-section-title text-lg">Simulations</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Enable <code className="rounded bg-zinc-100 px-1">ENABLE_V5_SIMULATION_AND_INTELLIGENCE</code> to use the
            change simulation studio and promotion tools.
          </p>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-5 py-3">Campaign</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Previewed</th>
              <th className="px-5 py-3">Processed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  {(campaigns ?? []).length === 0
                    ? "No campaigns yet."
                    : "No campaigns match the current filters."}
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((campaign) => {
                const preview = (campaign.preview_summary_json ?? {}) as Record<string, unknown>;
                const progress = (campaign.progress_summary_json ?? {}) as Record<string, unknown>;
                return (
                  <tr key={campaign.id}>
                    <td className="px-5 py-4 font-semibold text-zinc-900">
                      <Link href={`/campaigns/${campaign.id}`} className="ui-link">
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {CAMPAIGN_TYPE_LABELS[campaign.campaign_type as CampaignType] ??
                        campaign.campaign_type}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">{campaign.status}</td>
                    <td className="px-5 py-4 text-zinc-600">{Number(preview["pending"] ?? 0) + Number(preview["processed"] ?? 0)}</td>
                    <td className="px-5 py-4 text-zinc-600">{Number(progress["processed"] ?? 0)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

