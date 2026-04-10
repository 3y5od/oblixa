import Link from "next/link";
import { Shield, ShieldCheck } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
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
          action={{ href: "/api/control-policies", label: "View JSON", external: true }}
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
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
            <Link href={`/assurance/control-policies/${row.id}`} className="font-medium text-zinc-900 hover:underline">
              {row.name}
            </Link>
            <p className="mt-1 text-xs text-zinc-600">{row.objective}</p>
            <p className="mt-1 text-xs text-zinc-500">Mode {row.enforcement_mode} · {row.status}</p>
          </li>
        ))}
        {(data ?? []).length === 0 ? <li className="text-zinc-500">No control policies yet.</li> : null}
      </ul>
      <p className="mt-4 text-xs text-zinc-600">
        <Link className="ui-link" href="/api/control-policies" target="_blank">
          Policies JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/checks/run" target="_blank">
          POST checks/run (API)
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/analytics/summary" target="_blank">
          Analytics summary
        </Link>
        {" · "}
        <Link className="ui-link" href="/assurance">
          Assurance hub
        </Link>
      </p>
    </AssuranceListCard>
  );
}
