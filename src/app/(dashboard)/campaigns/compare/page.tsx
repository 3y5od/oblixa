import Link from "next/link";
import { GitCompare, ListOrdered, Sparkles, Split } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/decision-intelligence/feature-guards";

export default async function CampaignComparePage(props: {
  searchParams: Promise<{ campaignA?: string; campaignB?: string; simulationId?: string }>;
}) {
  const { campaignA, campaignB, simulationId } = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5PortfolioCampaigns");
  const { admin, orgId } = ctx;

  const [{ data: campaignList }, { data: simulationList }] = await Promise.all([
    admin
      .from("portfolio_campaigns")
      .select("id, name, status")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("change_simulations")
      .select("id, name, simulation_type")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const [campaignOne, campaignTwo, simulation] = await Promise.all([
    campaignA
      ? admin
          .from("portfolio_campaigns")
          .select("id, name, campaign_type, status, preview_summary_json, progress_summary_json")
          .eq("organization_id", orgId)
          .eq("id", campaignA)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    campaignB
      ? admin
          .from("portfolio_campaigns")
          .select("id, name, campaign_type, status, preview_summary_json, progress_summary_json")
          .eq("organization_id", orgId)
          .eq("id", campaignB)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    simulationId
      ? admin
          .from("change_simulations")
          .select("id, name, simulation_type, input_json")
          .eq("organization_id", orgId)
          .eq("id", simulationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const aPreview = (campaignOne.data?.preview_summary_json ?? {}) as Record<string, unknown>;
  const bPreview = (campaignTwo.data?.preview_summary_json ?? {}) as Record<string, unknown>;
  const aProgress = (campaignOne.data?.progress_summary_json ?? {}) as Record<string, unknown>;
  const bProgress = (campaignTwo.data?.progress_summary_json ?? {}) as Record<string, unknown>;
  const aProcessed = Number(aProgress.processed ?? 0);
  const bProcessed = Number(bProgress.processed ?? 0);
  const aPending = Number(aPreview.pending ?? 0);
  const bPending = Number(bPreview.pending ?? 0);
  const simInput = (simulation.data?.input_json ?? {}) as Record<string, unknown>;
  const simEligibility = Number(simInput.eligible_contracts ?? 0);

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Split className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Compare view"
        title="Campaign and simulation compare"
        lead="Review side-by-side output before promoting simulation assumptions into live campaign execution."
      />

      <section className="ui-card p-5">
        <p className="ui-label-caps">Pick items</p>
        <form className="mt-4 grid gap-4 md:grid-cols-3" method="get" action="/campaigns/compare">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Campaign A
            <select name="campaignA" className="ui-input-compact mt-1 w-full" defaultValue={campaignA ?? ""}>
              <option value="">—</option>
              {(campaignList ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Campaign B
            <select name="campaignB" className="ui-input-compact mt-1 w-full" defaultValue={campaignB ?? ""}>
              <option value="">—</option>
              {(campaignList ?? []).map((c) => (
                <option key={`b-${c.id}`} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Simulation
            <select name="simulationId" className="ui-input-compact mt-1 w-full" defaultValue={simulationId ?? ""}>
              <option value="">—</option>
              {(simulationList ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.simulation_type}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-sm">
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Diff</p>
          <h2 className="ui-section-title mt-2 text-xl">Compare signals</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Throughput"
            headline="Processed delta"
            tone="neutral"
            icon={GitCompare}
            primaryValue={campaignOne.data && campaignTwo.data ? aProcessed - bProcessed : null}
            primaryFallback="—"
            primaryUnit="A minus B processed"
            action={{ href: "/campaigns/compare", label: "Adjust selection" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Backlog"
            headline="Pending delta"
            tone="neutral"
            icon={ListOrdered}
            primaryValue={campaignOne.data && campaignTwo.data ? aPending - bPending : null}
            primaryFallback="—"
            primaryUnit="A minus B pending"
            action={{ href: "/campaigns/compare", label: "Adjust selection" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Simulation"
            headline="Eligible contracts"
            tone={simulation.data && simEligibility > 0 ? "neutral" : "healthy"}
            icon={Sparkles}
            primaryValue={simulation.data ? simEligibility : null}
            primaryFallback="—"
            primaryUnit="from simulation input"
            action={{ href: "/campaigns", label: "Back to campaigns" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="ui-card p-5">
          <p className="ui-label-caps">Campaign A</p>
          {campaignOne.data ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              <dt className="font-semibold text-[var(--text-primary)]">Type</dt>
              <dd>{campaignOne.data.campaign_type}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Status</dt>
              <dd>{campaignOne.data.status}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Pending</dt>
              <dd>{aPending}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Processed</dt>
              <dd>{aProcessed}</dd>
            </dl>
          ) : null}
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(campaignOne.data ?? { message: "Select campaign A above" }, null, 2)}
          </pre>
        </article>
        <article className="ui-card p-5">
          <p className="ui-label-caps">Campaign B</p>
          {campaignTwo.data ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              <dt className="font-semibold text-[var(--text-primary)]">Type</dt>
              <dd>{campaignTwo.data.campaign_type}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Status</dt>
              <dd>{campaignTwo.data.status}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Pending</dt>
              <dd>{bPending}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Processed</dt>
              <dd>{bProcessed}</dd>
            </dl>
          ) : null}
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(campaignTwo.data ?? { message: "Select campaign B above" }, null, 2)}
          </pre>
        </article>
        <article className="ui-card p-5">
          <p className="ui-label-caps">Simulation</p>
          {simulation.data ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              <dt className="font-semibold text-[var(--text-primary)]">Type</dt>
              <dd>{simulation.data.simulation_type}</dd>
              <dt className="font-semibold text-[var(--text-primary)]">Eligible contracts</dt>
              <dd>{simEligibility}</dd>
            </dl>
          ) : null}
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(simulation.data ?? { message: "Select a simulation above" }, null, 2)}
          </pre>
        </article>
      </section>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        <Link href="/campaigns" className="ui-link">
          Back to campaigns
        </Link>
      </p>
    </div>
  );
}
