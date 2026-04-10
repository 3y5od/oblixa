import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalMetricChip } from "@/components/ui/operational-summary-card";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { FindingActions } from "@/components/assurance/finding-actions";
import { RecommendedPlaybookRun } from "@/components/assurance/recommended-playbook-run";
import { FindingPolicyActions } from "@/components/assurance/finding-policy-actions";
import { getAuthContext } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";
import type { WorkspaceRole } from "@/lib/navigation";

export default async function AssuranceFindingDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6AssuranceCore");

  const { data: finding } = await ctx.admin
    .from("assurance_findings")
    .select(
      "id, title, summary, finding_type, severity, confidence, status, scope_json, linked_controls_json, linked_entities_json, recommended_playbook_id, analyst_note, updated_at, source_check_run_id"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();

  if (!finding) notFound();

  const scopePolicyId =
    typeof finding.scope_json === "object" && finding.scope_json !== null
      ? String((finding.scope_json as { policy_id?: string }).policy_id ?? "").trim()
      : "";

  let recommendedPlaybookName: string | null = null;
  if (finding.recommended_playbook_id) {
    const { data: pb } = await ctx.admin
      .from("adaptive_playbooks")
      .select("name, playbook_type")
      .eq("organization_id", ctx.orgId)
      .eq("id", String(finding.recommended_playbook_id))
      .maybeSingle();
    recommendedPlaybookName = pb?.name ? String(pb.name) : null;
  }

  const role = ctx.role as WorkspaceRole;
  const canManageFinding =
    role === "admin" || role === "manager" || role === "ops_manager" || role === "editor";

  const { data: events } = await ctx.admin
    .from("assurance_finding_events")
    .select("id, event_type, payload_json, created_at, actor_user_id")
    .eq("organization_id", ctx.orgId)
    .eq("finding_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const actorIds = [
    ...new Set(
      (events ?? [])
        .map((e) => (e as { actor_user_id?: string | null }).actor_user_id)
        .filter((x): x is string => Boolean(x))
    ),
  ];
  const { data: actorProfiles } =
    actorIds.length > 0
      ? await ctx.admin.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const actorLabel = new Map(
    (actorProfiles ?? []).map((p) => {
      const row = p as { id: string; full_name: string | null; email: string | null };
      const label = row.full_name?.trim() || row.email?.trim() || row.id.slice(0, 8);
      return [row.id, label];
    })
  );

  return (
    <AssuranceListCard
      title={finding.title}
      subtitle="Finding detail"
      explainer={
        <p>Linked entities, controls, source checks, and the event trail tie this finding back to rules and objects.</p>
      }
    >
      <p className="text-xs text-zinc-600">
        Triage: address higher severity and <span className="font-medium">open</span> items first; use the queue filters
        or{" "}
        <Link className="ui-link" href="/api/assurance/findings?status=open" target="_blank">
          open findings JSON
        </Link>{" "}
        for the same scope as the list view.
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="list">
        <OperationalMetricChip label="Type" value={String(finding.finding_type)} />
        <OperationalMetricChip label="Severity" value={String(finding.severity)} />
        <OperationalMetricChip label="Confidence" value={String(finding.confidence)} />
        <OperationalMetricChip label="Status" value={String(finding.status)} />
      </div>
      {finding.summary ? <p className="mt-3 text-sm text-zinc-700">{finding.summary}</p> : null}
      {scopePolicyId ? (
        <FindingPolicyActions
          policyId={scopePolicyId}
          canSimulate={canManageFinding && isFeatureEnabled("v6ControlPolicies")}
        />
      ) : null}
      {finding.analyst_note ? (
        <p className="mt-2 text-sm text-zinc-600">
          <span className="font-medium">Analyst note:</span> {finding.analyst_note}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-100 p-3">
          <p className="text-xs font-semibold text-zinc-500">Scope</p>
          <pre className="mt-2 max-h-40 overflow-auto text-[11px] text-zinc-700">
            {JSON.stringify(finding.scope_json ?? {}, null, 2)}
          </pre>
        </div>
        <div className="rounded-lg border border-zinc-100 p-3">
          <p className="text-xs font-semibold text-zinc-500">Linked controls</p>
          <pre className="mt-2 max-h-40 overflow-auto text-[11px] text-zinc-700">
            {JSON.stringify(finding.linked_controls_json ?? [], null, 2)}
          </pre>
        </div>
      </div>
      {Array.isArray(finding.linked_entities_json) && (finding.linked_entities_json as unknown[]).length > 0 ? (
        <div className="mt-4 rounded-lg border border-zinc-100 p-3">
          <p className="text-xs font-semibold text-zinc-500">Linked entities (drill-down)</p>
          <ul className="mt-2 space-y-1.5 text-xs text-zinc-700">
            {(finding.linked_entities_json as { type?: string; id?: string }[]).map((ent, i) => {
              const t = String(ent?.type ?? "unknown");
              const eid = ent?.id ? String(ent.id) : "";
              const label = `${t}${eid ? `: ${eid.length > 24 ? `${eid.slice(0, 24)}…` : eid}` : ""}`;
              let href: string | null = null;
              if (t === "contract" && eid) href = `/contracts/${encodeURIComponent(eid)}`;
              else if (t === "decision_workspace" && eid) href = `/decisions/${encodeURIComponent(eid)}`;
              return (
                <li key={`${t}-${eid}-${i}`} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-600">{label}</span>
                  {href ? (
                    <Link className="ui-link text-[11px]" href={href}>
                      Open
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {finding.source_check_run_id ? (
        <p className="mt-2 text-xs text-zinc-600">
          Source check run:{" "}
          <span className="font-mono text-[11px]">{String(finding.source_check_run_id)}</span>
          {" · "}
          <Link
            className="ui-link"
            href={`/api/assurance/check-runs/${encodeURIComponent(String(finding.source_check_run_id))}`}
            target="_blank"
          >
            Open run JSON
          </Link>
        </p>
      ) : null}
      {finding.recommended_playbook_id ? (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-xs text-zinc-700">
          <p className="font-semibold text-zinc-900">Recommended playbook</p>
          <p className="mt-1">
            {recommendedPlaybookName ?? "Linked playbook"}{" "}
            <span className="text-zinc-500">({String(finding.recommended_playbook_id)})</span>
          </p>
          <p className="mt-2">
            <Link className="ui-link" href="/assurance/playbooks">
              View all playbooks
            </Link>
          </p>
          {canManageFinding ? (
            <RecommendedPlaybookRun
              playbookId={String(finding.recommended_playbook_id)}
              playbookName={recommendedPlaybookName}
              findingId={id}
            />
          ) : null}
        </div>
      ) : null}
      {canManageFinding && (finding.status === "open" || finding.status === "in_review") ? (
        <FindingActions findingId={id} />
      ) : null}
      <p className="ui-label-caps mt-6">Audit trail (finding events)</p>
      <p className="mt-1 text-xs text-zinc-500">Up to 100 recent rows from assurance_finding_events.</p>
      <ul className="mt-2 space-y-2 text-sm">
        {(events ?? []).map((ev) => {
          const row = ev as {
            id: string;
            event_type: string;
            created_at: string;
            actor_user_id?: string | null;
            payload_json: unknown;
          };
          const actor = row.actor_user_id ? actorLabel.get(row.actor_user_id) : null;
          return (
            <li key={row.id} className="rounded border border-zinc-100 p-2 text-xs">
              <span className="font-medium">{row.event_type}</span> · {String(row.created_at)}
              {actor ? (
                <span className="text-zinc-600">
                  {" "}
                  · actor <span className="font-medium text-zinc-800">{actor}</span>
                </span>
              ) : row.actor_user_id ? (
                <span className="font-mono text-[10px] text-zinc-400"> · {row.actor_user_id.slice(0, 8)}…</span>
              ) : null}
              <pre className="mt-1 text-[10px] text-zinc-500">{JSON.stringify(row.payload_json, null, 2)}</pre>
            </li>
          );
        })}
        {(events ?? []).length === 0 ? <li className="text-zinc-500">No events yet.</li> : null}
      </ul>
      <p className="mt-4 text-xs">
        <Link
          className="ui-link"
          href={`/api/assurance/findings?findingType=${encodeURIComponent(String(finding.finding_type))}`}
          target="_blank"
        >
          Same-type findings (JSON)
        </Link>
        {" · "}
        <Link className="ui-link" href={`/api/assurance/findings/${encodeURIComponent(id)}/events`} target="_blank">
          Export events JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/check-runs?limit=40" target="_blank">
          Check runs JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/assurance/findings">
          Back to findings
        </Link>
      </p>
    </AssuranceListCard>
  );
}
