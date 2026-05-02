import Link from "next/link";
import { ListOrdered, Megaphone, PauseCircle } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  CAMPAIGN_TYPE_LABELS,
  isValidCampaignType,
  type CampaignType,
} from "@/lib/v5/campaign-types";
import { CampaignSimulationPromote } from "@/components/campaigns/campaign-simulation-promote";
import {
  DiagnosticDisclosure,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { SIMULATION_TYPE_FOCUS, type SimulationType } from "@/lib/v5/simulation-types";

function campaignStatusTone(status: string): SemanticStatus {
  if (status === "active") return "healthy";
  if (status === "paused") return "warning";
  if (status === "previewed") return "in_review";
  if (status === "closed") return "disabled";
  return "info";
}

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
    <div className="ui-page-stack">
      <header className="ui-page-header-compact">
        <div>
          <p className="ui-eyebrow">Records</p>
          <h1 className="ui-page-title-compact mt-2">Campaign Queue</h1>
          <p className="ui-page-lead mt-2 max-w-2xl">
            Campaign state, processed volume, simulation readiness, and next action.
            {statusFilter || typeFilter ? (
              <span className="mt-2 block text-xs text-[var(--text-secondary)]">
                {statusFilter && statusOk ? (
                  <>
                    Status <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">{statusFilter}</code>
                    {!typeFilter ? ". " : " · "}
                  </>
                ) : null}
                {statusFilter && !statusOk ? <span className="text-[var(--danger-ink)]">Unknown status filter (ignored). </span> : null}
                {typeFilter && typeOk ? (
                  <>
                    Type <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">{typeFilter}</code>.{" "}
                  </>
                ) : null}
                {typeFilter && !typeOk ? <span className="text-[var(--danger-ink)]">Unknown campaign type filter (ignored). </span> : null}
                <Link href="/campaigns" className="ui-link">
                  Clear filters
                </Link>
              </span>
            ) : null}
          </p>
        </div>
      </header>
      <DiagnosticDisclosure title="Campaign diagnostics">
        <div className="flex flex-wrap gap-3">
          <Link href="/api/campaigns" className="ui-link text-xs" target="_blank">
            Inspect campaign payload
          </Link>
          <Link href="/api/intelligence/portfolio-signals" className="ui-link text-xs" target="_blank">
            Inspect signal payload
          </Link>
        </div>
      </DiagnosticDisclosure>

      <section className="ui-page-shell space-y-3">
        <div>
          <p className="ui-eyebrow">Rollout</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Campaign metrics</h2>
          <p className="ui-section-lead mt-2">
            Active rollout state, paused work, and contracts processed under the current filters.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Live"
            headline="Active"
            tone={activeCount > 0 ? "neutral" : "healthy"}
            icon={Megaphone}
            primaryValue={activeCount}
            primaryUnit="campaigns running"
            action={{ href: "/campaigns?status=active", label: "Review active" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Paused"
            headline="On hold"
            tone={pausedCount > 0 ? "attention" : "healthy"}
            icon={PauseCircle}
            primaryValue={pausedCount}
            primaryUnit="paused campaigns"
            action={{ href: "/campaigns?status=paused", label: "Review paused" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Throughput"
            headline="Contracts processed"
            tone="neutral"
            icon={ListOrdered}
            primaryValue={totalProcessed}
            primaryUnit="under current filters"
            action={{ href: "/campaigns", label: "Review campaigns" }}
            variant="compact"
          />
        </div>
      </section>

      {simOn ? (
        <section id="simulations" className="scroll-mt-8 ui-page-shell space-y-6">
          <div>
            <p className="ui-eyebrow">Simulation</p>
            <h2 className="ui-page-title mt-1 text-[1.8rem]">Simulation studio</h2>
            <p className="ui-section-lead mt-2">Recent simulation runs and promotion readiness.</p>
          </div>
          <details className="ui-soft-details text-sm text-[var(--text-secondary)]">
            <summary className="cursor-pointer font-medium text-[var(--text-primary)]">Simulation types</summary>
            <ul className="mt-3 space-y-2 text-xs">
              {(Object.keys(SIMULATION_TYPE_FOCUS) as SimulationType[]).map((k) => (
                <li key={k}>
                  <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">{k}</code> — {SIMULATION_TYPE_FOCUS[k]}
                </li>
              ))}
            </ul>
          </details>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="ui-page-shell p-5">
              <p className="ui-label-caps">Saved simulations</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-[var(--text-secondary)]">
                {(simulations ?? []).length === 0 ? (
                  <li className="text-[var(--text-secondary)]">No simulations yet.</li>
                ) : (
                  (simulations ?? []).map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 last:border-0">
                      <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{s.simulation_type}</span>
                      <Link
                        href={`/api/simulations/${s.id}`}
                        className="ui-link text-xs"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View JSON
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </article>
            <article className="ui-page-shell p-5">
              <p className="ui-label-caps">Recent runs</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-[var(--text-secondary)]">
                {(simRuns ?? []).length === 0 ? (
                  <li className="text-[var(--text-secondary)]">No runs yet.</li>
                ) : (
                  (simRuns ?? []).map((r) => (
                    <li key={r.id} className="border-b border-[var(--border-subtle)] pb-2 text-xs last:border-0">
                      <span className="font-mono text-[var(--text-secondary)]">{r.id.slice(0, 8)}…</span> · sim{" "}
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
                          Simulation JSON
                        </Link>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
          <div>
            <p className="ui-eyebrow">Rollout</p>
            <h3 className="ui-section-title mt-1 text-base">Promote to campaign</h3>
            <p className="ui-muted-tight mt-1 text-[13px]">Create a draft campaign from a completed simulation.</p>
            <div className="mt-4">
              <CampaignSimulationPromote />
            </div>
          </div>
        </section>
      ) : (
        <section id="simulations" className="scroll-mt-8">
          <h2 className="ui-section-title text-lg">Simulations</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Change simulation studio and promotion tools are disabled for this workspace. Ask an administrator to
            enable simulation and intelligence features.
          </p>
        </section>
      )}

      <div className="ui-table-shell">
        <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
          <thead className="ui-table-header">
            <tr>
              <th className="px-5 py-3">Campaign</th>
              <th className="px-5 py-3">Object</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">Previewed</th>
              <th className="px-5 py-3">Processed</th>
              <th className="px-5 py-3">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8">
                  <EmptyState
                    title="No campaigns in queue"
                    copy={(campaigns ?? []).length === 0 ? "No campaign records yet." : "No campaign records match the current filters."}
                  />
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((campaign) => {
                const preview = (campaign.preview_summary_json ?? {}) as Record<string, unknown>;
                const progress = (campaign.progress_summary_json ?? {}) as Record<string, unknown>;
                return (
                <tr key={campaign.id} className="ui-table-row">
                    <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                      <Link href={`/campaigns/${campaign.id}`} className="ui-link">
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">Campaign</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">
                      {CAMPAIGN_TYPE_LABELS[campaign.campaign_type as CampaignType] ??
                        campaign.campaign_type}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={campaignStatusTone(campaign.status)}>{campaign.status}</StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">Unassigned</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{Number(preview["pending"] ?? 0) + Number(preview["processed"] ?? 0)}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{Number(progress["processed"] ?? 0)}</td>
                    <td className="px-5 py-4">
                      <Link href={`/campaigns/${campaign.id}`} className="ui-link">
                        Review campaign
                      </Link>
                    </td>
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

