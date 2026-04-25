import Link from "next/link";
import { BookOpen } from "lucide-react";
import { notFound } from "next/navigation";
import { CampaignAssignmentPanel } from "@/components/campaigns/campaign-assignment-panel";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { CampaignControlPanel } from "@/components/campaigns/campaign-control-panel";
import { CampaignSimulationPromote } from "@/components/campaigns/campaign-simulation-promote";
import { RelationshipTimelineCard } from "@/components/relationship/relationship-timeline-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5PortfolioCampaigns");

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const showAssurancePlaybooksLink = productSurface.seesAssuranceNav;
  const showCampaignCompareLink = evaluateFeatureEligibility(productSurface, "compare_views").allowed;

  const { admin, orgId } = ctx;
  const apiCtx = await getApiAuthContext();
  const canEditAssignments =
    Boolean(apiCtx) && (await canManageCapability(apiCtx!, "maintenance_manage"));

  const { data: campaign } = await admin
    .from("portfolio_campaigns")
    .select(
      "id, name, campaign_type, status, eligibility_json, assignment_json, preview_summary_json, progress_summary_json, rollback_safe, rolled_back_at, updated_at"
    )
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const showSimulation = isFeatureEnabled("v5SimulationAndIntelligence");
  const showRelationship = isFeatureEnabled("v5RelationshipLayer");
  const elig = campaign.eligibility_json as Record<string, unknown> | null;
  const eligAccount =
    elig && typeof elig.accountKey === "string" ? elig.accountKey : null;
  const eligCounterparty =
    elig && typeof elig.counterpartyKey === "string" ? elig.counterpartyKey : null;

  const { data: rows } = await admin
    .from("portfolio_campaign_contracts")
    .select("id, contract_id, status, status_reason, segment_key, assigned_team, updated_at")
    .eq("organization_id", orgId)
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const progress = campaign.progress_summary_json as Record<string, unknown> | null;
  const segmentBreakdown =
    progress &&
    typeof progress.segment_breakdown === "object" &&
    progress.segment_breakdown !== null &&
    !Array.isArray(progress.segment_breakdown)
      ? (progress.segment_breakdown as Record<string, Record<string, number>>)
      : null;
  const teamBreakdown =
    progress &&
    typeof progress.team_breakdown === "object" &&
    progress.team_breakdown !== null &&
    !Array.isArray(progress.team_breakdown)
      ? (progress.team_breakdown as Record<string, Record<string, number>>)
      : null;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Campaign detail</p>
          <h1 className="ui-display-title mt-2">{campaign.name}</h1>
          <p className="ui-muted-tight mt-2">
            Type: {campaign.campaign_type} · Status: {campaign.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/api/campaigns/${id}`} className="ui-btn-secondary px-4 py-2.5 text-[13px]" target="_blank">
            Open JSON
          </Link>
          <Link href="/campaigns" className="ui-btn-ghost px-4 py-2.5 text-[13px]">
            Back to campaigns
          </Link>
        </div>
      </header>

      {showRelationship && (eligAccount || eligCounterparty) ? (
        <>
          <section className="ui-card p-5">
            <p className="ui-label-caps">Relationship context</p>
            <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
              {eligAccount ? (
                <li>
                  Account:{" "}
                  <Link href={`/accounts/${encodeURIComponent(eligAccount)}`} className="ui-link">
                    {eligAccount}
                  </Link>
                </li>
              ) : null}
              {eligCounterparty ? (
                <li>
                  Counterparty:{" "}
                  <Link href={`/counterparties/${encodeURIComponent(eligCounterparty)}`} className="ui-link">
                    {eligCounterparty}
                  </Link>
                </li>
              ) : null}
            </ul>
          </section>
          <RelationshipTimelineCard accountKey={eligAccount} counterpartyKey={eligCounterparty} />
        </>
      ) : null}

      {showAssurancePlaybooksLink ? (
        <section aria-label="Assurance playbooks">
          <OperationalSurfaceLinkCard
            href="/assurance/playbooks"
            eyebrow="Assurance"
            title="Playbooks"
            hint="Tie bulk remediation and campaign follow-up to documented response playbooks."
            icon={BookOpen}
            actionLabel="Open playbooks"
            tone="neutral"
          />
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <CampaignControlPanel
          campaignId={id}
          status={campaign.status}
          rolledBackAt={campaign.rolled_back_at}
          showCompareLink={showCampaignCompareLink}
        />
        <article className="ui-card p-5">
          <p className="ui-label-caps">Eligibility</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(campaign.eligibility_json ?? {}, null, 2)}
          </pre>
        </article>
        <article className="ui-card p-5">
          <p className="ui-label-caps">Preview summary</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(campaign.preview_summary_json ?? {}, null, 2)}
          </pre>
          <p className="ui-label-caps mt-4">Progress summary</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(campaign.progress_summary_json ?? {}, null, 2)}
          </pre>
          {segmentBreakdown && Object.keys(segmentBreakdown).length > 0 ? (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <p className="ui-label-caps">Segment / cohort breakdown</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="min-w-full text-left text-xs text-[var(--text-secondary)]">
                  <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-3 py-2">Segment</th>
                      <th className="px-3 py-2">Pending</th>
                      <th className="px-3 py-2">In progress</th>
                      <th className="px-3 py-2">Processed</th>
                      <th className="px-3 py-2">Failed</th>
                      <th className="px-3 py-2">Skipped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {Object.entries(segmentBreakdown).map(([seg, counts]) => (
                      <tr key={seg}>
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{seg}</td>
                        <td className="px-3 py-2">{counts.pending ?? 0}</td>
                        <td className="px-3 py-2">{counts.in_progress ?? 0}</td>
                        <td className="px-3 py-2">{counts.processed ?? 0}</td>
                        <td className="px-3 py-2">{counts.failed ?? 0}</td>
                        <td className="px-3 py-2">{counts.skipped ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {teamBreakdown && Object.keys(teamBreakdown).length > 0 ? (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <p className="ui-label-caps">Assigned team cohort breakdown</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="min-w-full text-left text-xs text-[var(--text-secondary)]">
                  <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-3 py-2">Team</th>
                      <th className="px-3 py-2">Pending</th>
                      <th className="px-3 py-2">In progress</th>
                      <th className="px-3 py-2">Processed</th>
                      <th className="px-3 py-2">Failed</th>
                      <th className="px-3 py-2">Skipped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {Object.entries(teamBreakdown).map(([team, counts]) => (
                      <tr key={team}>
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{team}</td>
                        <td className="px-3 py-2">{counts.pending ?? 0}</td>
                        <td className="px-3 py-2">{counts.in_progress ?? 0}</td>
                        <td className="px-3 py-2">{counts.processed ?? 0}</td>
                        <td className="px-3 py-2">{counts.failed ?? 0}</td>
                        <td className="px-3 py-2">{counts.skipped ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {showSimulation ? <CampaignSimulationPromote campaignContextId={id} /> : null}
        </article>
      </section>

      <CampaignAssignmentPanel
        campaignId={id}
        initialAssignment={
          (campaign.assignment_json && typeof campaign.assignment_json === "object"
            ? (campaign.assignment_json as Record<string, unknown>)
            : {}) ?? {}
        }
        contracts={(rows ?? []).map((r) => ({
          id: r.id,
          contract_id: r.contract_id,
          segment_key: r.segment_key,
          assigned_team: r.assigned_team,
          status: r.status,
          updated_at: r.updated_at,
        }))}
        canEdit={canEditAssignments}
      />
    </div>
  );
}

