import Link from "next/link";
import { Shield, ShieldCheck } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";

export default async function AssuranceControlPoliciesPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6ControlPolicies");

  const { data } = await ctx.admin
    .from("control_policies")
    .select("id, name, objective, enforcement_mode, status, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const policies = data ?? [];
  const published = policies.filter((p) => String(p.status).toLowerCase() === "published").length;

  return (
    <AssuranceListCard
      title="Control policies"
      subtitle="Assurance"
      explainer={<p>Controls are machine-readable and enforceable across segments with publish and simulation lifecycle.</p>}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard
          eyebrow="Catalog"
          headline="Policies"
          tone="neutral"
          icon={Shield}
          primaryValue={policies.length}
          primaryUnit="in workspace"
          action={{ href: "/api/control-policies", label: "Inspect policy feed", external: true }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Published"
          headline="Live controls"
          tone={published > 0 ? "healthy" : "attention"}
          icon={ShieldCheck}
          primaryValue={published}
          primaryUnit="published status"
          action={{ href: "/assurance/control-policies", label: "Refresh list" }}
          variant="compact"
        />
      </div>
      <p className="ui-support-copy mb-4">
        Review the policy catalog as a layered control surface: published policies are the active guardrail set, while draft
        and simulated entries remain visible for governance and rollout planning.
      </p>
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => (
          <li key={row.id} className="ui-operational-card p-4">
            <Link href={`/assurance/control-policies/${row.id}`} className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)] hover:underline">
              {row.name}
            </Link>
            <p className="ui-support-copy mt-1">{row.objective}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="ui-metric-chip">Mode {row.enforcement_mode}</span>
              <span className="ui-metric-chip">{row.status}</span>
            </div>
          </li>
        ))}
        {(data ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No control policies yet.</li> : null}
      </ul>
      <p className="mt-4 text-xs text-[var(--text-secondary)]">
        <ApiJsonLink className="ui-link" href="/api/control-policies">
          Policies JSON
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/checks/run">
          POST checks/run (API)
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
          Analytics summary
        </ApiJsonLink>
        {" · "}
        <Link className="ui-link" href="/assurance">
          Assurance hub
        </Link>
      </p>
    </AssuranceListCard>
  );
}
