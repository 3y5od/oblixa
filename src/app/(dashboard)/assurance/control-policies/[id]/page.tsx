import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { ControlPolicyAssignPanel } from "@/components/assurance/control-policy-assign-panel";
import { ControlPolicyDetailActions } from "@/components/assurance/control-policy-detail-actions";
import { ControlPolicyRemediationPlaybookPanel } from "@/components/assurance/control-policy-remediation-playbook";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";
import { diffPolicyJsonObjects } from "@/lib/v6/policy-json-diff";

const ENFORCEMENT_HELP: Record<string, string> = {
  observe_only: "Records evaluation only; no automated side effects.",
  warn: "Adds finding events when a linked assurance finding exists.",
  create_exception: "Opens a policy_control exception linked to the finding when possible.",
  require_decision_workspace: "Creates an open policy_exception decision workspace scoped to contracts.",
  trigger_campaign: "Creates a draft remediation campaign and attaches scoped contracts.",
  trigger_autopilot_action: "Runs an enabled autopilot rule or falls back to a bounded external link.",
  escalate_immediately: "Raises finding severity and creates a critical policy_escalation exception.",
};

export default async function ControlPolicyDetailPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6ControlPolicies");

  const { id: policyId } = await props.params;
  const { data: policy } = await ctx.admin
    .from("control_policies")
    .select("id, name, objective, enforcement_mode, status, latest_version_id, updated_at, remediation_playbook_id")
    .eq("organization_id", ctx.orgId)
    .eq("id", policyId)
    .maybeSingle();

  if (!policy) notFound();

  const remId = (policy as { remediation_playbook_id?: string | null }).remediation_playbook_id;

  const [{ data: versions }, { data: assignments }, { data: segments }, { data: remediationPb }] = await Promise.all([
    ctx.admin
      .from("control_policy_versions")
      .select("id, version, published, published_at, created_at, policy_json")
      .eq("organization_id", ctx.orgId)
      .eq("control_policy_id", policyId)
      .order("version", { ascending: false })
      .limit(12),
    ctx.admin
      .from("control_policy_assignments")
      .select("id, assignment_type, segment_id, target_ref_type, target_ref_id, active, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("control_policy_id", policyId)
      .order("created_at", { ascending: false })
      .limit(40),
    ctx.admin
      .from("segment_definitions")
      .select("id, name, key")
      .eq("organization_id", ctx.orgId)
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(100),
    remId
      ? ctx.admin
          .from("adaptive_playbooks")
          .select("id, name")
          .eq("organization_id", ctx.orgId)
          .eq("id", remId)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; name: string } | null }),
  ]);

  const vers = versions ?? [];
  const vNew = vers[0] as { policy_json?: Record<string, unknown>; version?: number } | undefined;
  const vOld = vers[1] as { policy_json?: Record<string, unknown>; version?: number } | undefined;
  const versionDiff =
    vNew && vOld ? diffPolicyJsonObjects(vOld.policy_json ?? {}, vNew.policy_json ?? {}) : [];

  const modeHelp = ENFORCEMENT_HELP[String(policy.enforcement_mode)] ?? "Custom enforcement mode.";

  return (
    <div className="ui-page-stack">
      <Link href="/assurance/control-policies" className="ui-link text-xs">
        ← All control policies
      </Link>
      <AssuranceListCard
        title={policy.name}
        subtitle="Control policy"
        explainer={
          <p>
            {modeHelp} Machine-readable thresholds live on each published version; simulation runs a live evaluation
            against current portfolio data.
          </p>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">{policy.objective}</p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Status {policy.status} · Enforcement <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">{policy.enforcement_mode}</code>
        </p>
        {remId ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Remediation playbook:{" "}
            {remediationPb?.name ? (
              <Link className="ui-link font-medium" href="/assurance/playbooks">
                {remediationPb.name}
              </Link>
            ) : (
              <span className="font-mono text-xs text-[var(--text-tertiary)]">{remId}</span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">No remediation playbook linked on this policy yet.</p>
        )}
        <ControlPolicyRemediationPlaybookPanel policyId={policyId} currentRemediationPlaybookId={remId ?? null} />
        <div className="mt-4">
          <ControlPolicyDetailActions policyId={policyId} />
        </div>
      </AssuranceListCard>

      {versionDiff.length > 0 && vNew && vOld ? (
        <AssuranceListCard
          title="Latest vs previous version"
          subtitle="Diff"
          explainer={
            <p>
              Changes from version {vOld.version} → {vNew.version} (policy_json keys only).
            </p>
          }
        >
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {versionDiff.slice(0, 40).map((d) => (
              <li key={d.key} className="ui-soft-details px-2 py-1.5">
                <span className="font-semibold text-[var(--text-primary)]">{d.key}</span>{" "}
                <span className="text-[var(--text-tertiary)]">({d.change})</span>
                {d.change === "changed" ? (
                  <pre className="ui-alert-warning mt-1 max-h-24 overflow-auto p-1 font-mono text-[11px]">
                    {JSON.stringify({ before: d.before, after: d.after }, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
            {versionDiff.length > 40 ? (
              <li className="text-[var(--text-tertiary)]">…and {versionDiff.length - 40} more keys</li>
            ) : null}
          </ul>
        </AssuranceListCard>
      ) : null}

      <AssuranceListCard title="Published versions" subtitle="Lineage" explainer={<p>Compare numeric thresholds between rollouts.</p>}>
        <ul className="space-y-3 text-sm">
          {(versions ?? []).map((v) => {
            const pj = (v as { policy_json?: Record<string, unknown> }).policy_json ?? {};
            const keys = Object.keys(pj).filter((k) => k !== "schema" && k !== "published_by" && k !== "published_at");
            return (
              <li key={String(v.id)} className="ui-support-panel p-3">
                <p className="font-medium text-[var(--text-primary)]">
                  Version {(v as { version: number }).version}
                  {(v as { published?: boolean }).published ? " · published" : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {(v as { published_at?: string }).published_at ?? (v as { created_at?: string }).created_at}
                </p>
                {keys.length > 0 ? (
                  <pre className="ui-soft-details mt-2 max-h-40 overflow-auto p-2 text-[11px] text-[var(--text-secondary)]">
                    {JSON.stringify(
                      keys.reduce<Record<string, unknown>>((acc, k) => {
                        acc[k] = pj[k];
                        return acc;
                      }, {}),
                      null,
                      2
                    )}
                  </pre>
                ) : null}
              </li>
            );
          })}
          {(versions ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No versions yet — publish to create v1.</li> : null}
        </ul>
      </AssuranceListCard>

      <AssuranceListCard title="Assignments" subtitle="Scope" explainer={<p>Policies evaluate against org metrics or scoped contracts.</p>}>
        <ControlPolicyAssignPanel
          policyId={policyId}
          segments={(segments ?? []).map((s) => ({
            id: String((s as { id: string }).id),
            name: String((s as { name: string }).name),
            key: String((s as { key: string }).key),
          }))}
        />
        <ul className="mt-4 space-y-2 text-sm">
          {(assignments ?? []).map((a) => (
            <li key={String((a as { id: string }).id)} className="ui-support-panel px-3 py-2">
              <span className="font-medium">{(a as { assignment_type: string }).assignment_type}</span>
              {(a as { active: boolean }).active ? "" : " (inactive)"}
              {(a as { segment_id?: string | null }).segment_id ? (
                <span className="ml-2 text-xs text-[var(--text-tertiary)]">segment {(a as { segment_id: string }).segment_id}</span>
              ) : null}
              {(a as { target_ref_type?: string | null }).target_ref_type ? (
                <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                  {(a as { target_ref_type: string }).target_ref_type}: {(a as { target_ref_id?: string }).target_ref_id}
                </span>
              ) : null}
            </li>
          ))}
          {(assignments ?? []).length === 0 ? (
            <li className="text-[var(--text-tertiary)]">No assignments — evaluation uses organization-wide rollup.</li>
          ) : null}
        </ul>
      </AssuranceListCard>
    </div>
  );
}
