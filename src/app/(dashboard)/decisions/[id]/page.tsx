import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { DecisionExecutionContextCard } from "@/components/decisions/decision-execution-context";
import { DecisionWorkspacePanel } from "@/components/decisions/decision-workspace-panel";
import { DecisionExternalPanel } from "@/components/decisions/decision-external-panel";
import { RelationshipTimelineCard } from "@/components/relationship/relationship-timeline-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { buildDecisionExecutionContext } from "@/lib/v5/decision-context";
import { isDecisionPacketServerPdfEnabled } from "@/lib/v5/decision-packet-export";
import { isValidPacketType } from "@/lib/v5/packet-types";

export default async function DecisionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ packetType?: string }>;
}) {
  const { id } = await params;
  const { packetType: packetTypeParam } = await searchParams;
  const initialExportPacketType =
    packetTypeParam && isValidPacketType(packetTypeParam) ? packetTypeParam : undefined;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5DecisionFoundation");

  const { admin, orgId } = ctx;
  const showRelationshipLinks = isFeatureEnabled("v5RelationshipLayer");
  const showExternal = isFeatureEnabled("v5ExternalCollaboration");
  const serverPacketPdf = isDecisionPacketServerPdfEnabled();
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const { data: decision } = await admin
    .from("decision_workspaces")
    .select(
      "id, title, decision_type, status, linked_contract_ids, linked_account_key, linked_counterparty_key, owner_user_id, due_at, required_inputs_json, approval_path_json, recommendation_json, rationale_markdown, final_disposition_json, post_decision_actions_json, updated_at"
    )
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!decision) notFound();

  const [
    { data: events },
    { data: stakeholders },
    { data: recommendations },
    { data: packetRuns },
    { data: externalLinkRows },
  ] = await Promise.all([
    admin
      .from("decision_workspace_events")
      .select("id, event_type, payload_json, created_at")
      .eq("organization_id", orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("decision_workspace_stakeholders")
      .select("id, stakeholder_user_id, stakeholder_role, status, notes, responded_at, created_at")
      .eq("organization_id", orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("decision_recommendations")
      .select(
        "id, recommendation_type, recommendation_text, confidence, reasons_json, source_object_refs_json, accepted, created_at"
      )
      .eq("organization_id", orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("decision_packet_runs")
      .select("id, packet_type, exported_at, created_at")
      .eq("organization_id", orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    showExternal
      ? admin
          .from("external_action_links")
          .select("id, token, action_type, status, expires_at, submitted_at, scope_json, created_at")
          .eq("organization_id", orgId)
          .eq("decision_workspace_id", id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const externalLinksForDecision = showExternal ? (externalLinkRows ?? []) : [];

  function workflowFieldsFromScope(scope: unknown) {
    const s = scope as Record<string, unknown> | null | undefined;
    if (!s) {
      return {
        workflowStepCount: 0,
        workflowDeadlineIso: null as string | null,
        lastWorkflowStepType: null as string | null,
        correctionMessage: null as string | null,
      };
    }
    const chain = Array.isArray(s.workflow_chain) ? s.workflow_chain : [];
    const last = chain.length > 0 ? (chain[chain.length - 1] as Record<string, unknown>) : null;
    return {
      workflowStepCount: chain.length,
      workflowDeadlineIso: typeof s.workflow_deadline_iso === "string" ? s.workflow_deadline_iso : null,
      lastWorkflowStepType: last && typeof last.type === "string" ? last.type : null,
      correctionMessage: typeof s.correction_message === "string" ? s.correction_message : null,
    };
  }

  const executionContext = await buildDecisionExecutionContext(
    admin,
    orgId,
    decision.linked_contract_ids
  );

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Decision workspace</p>
          <h1 className="ui-display-title mt-2">{decision.title}</h1>
          <p className="ui-muted-tight mt-2">
            Type: {decision.decision_type} · Status: {decision.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/api/decisions/${id}`} className="ui-btn-secondary px-4 py-2.5 text-[13px]" target="_blank">
            Open JSON
          </Link>
          <Link href="/decisions" className="ui-btn-ghost px-4 py-2.5 text-[13px]">
            Back to queue
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="ui-card p-5">
          <p className="ui-label-caps">Required inputs</p>
          {decision.required_inputs_json &&
          typeof decision.required_inputs_json === "object" &&
          !Array.isArray(decision.required_inputs_json) &&
          Object.keys(decision.required_inputs_json as object).length > 0 ? (
            <pre className="mt-3 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
              {JSON.stringify(decision.required_inputs_json, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">No required inputs recorded yet.</p>
          )}
        </article>
        <article className="ui-card p-5">
          <p className="ui-label-caps">Post-close actions (planned)</p>
          {Array.isArray(decision.post_decision_actions_json) &&
          (decision.post_decision_actions_json as unknown[]).length > 0 ? (
            <pre className="mt-3 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
              {JSON.stringify(decision.post_decision_actions_json, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">None configured on the workspace row.</p>
          )}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="ui-card p-5 lg:col-span-2">
          <p className="ui-label-caps">Decision rationale</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
            {decision.rationale_markdown?.trim() || "No rationale has been captured yet."}
          </p>
          {decision.final_disposition_json &&
          typeof decision.final_disposition_json === "object" &&
          Object.keys(decision.final_disposition_json as object).length > 0 ? (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <p className="ui-label-caps">Final disposition</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
                {JSON.stringify(decision.final_disposition_json, null, 2)}
              </pre>
            </div>
          ) : null}
        </article>
        <div className="space-y-4">
          <article className="ui-card p-5">
            <p className="ui-label-caps">Scope</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
              <li>Due: {decision.due_at ? new Date(decision.due_at).toLocaleDateString() : "Not set"}</li>
              <li>Contracts: {Array.isArray(decision.linked_contract_ids) ? decision.linked_contract_ids.length : 0}</li>
              <li>
                Account key:{" "}
                {decision.linked_account_key && showRelationshipLinks ? (
                  <Link
                    href={`/accounts/${encodeURIComponent(decision.linked_account_key)}`}
                    className="ui-link"
                  >
                    {decision.linked_account_key}
                  </Link>
                ) : (
                  (decision.linked_account_key ?? "—")
                )}
              </li>
              <li>
                Counterparty key:{" "}
                {decision.linked_counterparty_key && showRelationshipLinks ? (
                  <Link
                    href={`/counterparties/${encodeURIComponent(decision.linked_counterparty_key)}`}
                    className="ui-link"
                  >
                    {decision.linked_counterparty_key}
                  </Link>
                ) : (
                  (decision.linked_counterparty_key ?? "—")
                )}
              </li>
            </ul>
          </article>
          <DecisionWorkspacePanel
            decisionId={id}
            decisionType={decision.decision_type}
            status={decision.status}
            ownerUserId={decision.owner_user_id}
            dueAt={decision.due_at}
            rationaleMarkdown={decision.rationale_markdown}
            requiredInputsJson={decision.required_inputs_json}
            approvalPathJson={decision.approval_path_json}
            initialExportPacketType={initialExportPacketType}
          />
        </div>
      </section>

      <DecisionExecutionContextCard decisionId={id} context={executionContext} />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="ui-card p-5">
          <p className="ui-label-caps">Recommendations</p>
          <div className="mt-3 space-y-3">
            {(recommendations ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No recommendations yet.</p>
            ) : (
              (recommendations ?? []).map((r) => (
                <div key={r.id} className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-sm">
                  <p className="font-medium text-[var(--text-primary)]">{r.recommendation_type}</p>
                  <p className="mt-1 text-[var(--text-secondary)]">{r.recommendation_text}</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Confidence {r.confidence}% · {r.accepted ? "Accepted" : "Pending"}
                  </p>
                  {Array.isArray(r.source_object_refs_json) && r.source_object_refs_json.length > 0 ? (
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      Linked refs: {r.source_object_refs_json.length}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </article>

        <article className="ui-card p-5">
          <p className="ui-label-caps">Stakeholders</p>
          <div className="mt-3 space-y-3">
            {(stakeholders ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No stakeholders recorded.</p>
            ) : (
              (stakeholders ?? []).map((s) => (
                <div key={s.id} className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-sm">
                  <p className="font-medium text-[var(--text-primary)]">{s.stakeholder_role}</p>
                  <p className="text-xs text-[var(--text-secondary)]">User: {s.stakeholder_user_id ?? "—"}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Status: {s.status}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {showRelationshipLinks && (decision.linked_account_key || decision.linked_counterparty_key) ? (
        <RelationshipTimelineCard
          accountKey={decision.linked_account_key}
          counterpartyKey={decision.linked_counterparty_key}
        />
      ) : null}

      {showExternal ? (
        <DecisionExternalPanel
          decisionId={id}
          appOrigin={appOrigin || undefined}
          initialLinks={externalLinksForDecision.map((l) => {
            const w = workflowFieldsFromScope(l.scope_json);
            return {
              id: l.id,
              token: l.token,
              action_type: l.action_type,
              status: l.status,
              expires_at: l.expires_at,
              submitted_at: l.submitted_at,
              ...w,
            };
          })}
        />
      ) : null}

      <section className="ui-card p-5">
        <p className="ui-label-caps">Packet export history</p>
        {!serverPacketPdf ? (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Downloadable PDF files are off for this workspace. Use HTML export and print to PDF from your browser,
            or ask an administrator to enable server-side PDF export.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {(packetRuns ?? []).length === 0 ? (
            <li className="text-[var(--text-tertiary)]">No packets exported yet.</li>
          ) : (
            (packetRuns ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {p.packet_type} · {p.exported_at ? new Date(p.exported_at).toLocaleString() : "—"}
                </span>
                <Link
                  href={`/api/decisions/${id}/packet-runs/${p.id}`}
                  className="ui-link text-xs"
                  target="_blank"
                  rel="noreferrer"
                >
                  JSON
                </Link>
                <Link
                  href={`/api/decisions/${id}/packet-runs/${p.id}?format=html`}
                  className="ui-link text-xs"
                  target="_blank"
                  rel="noreferrer"
                >
                  HTML (print to PDF)
                </Link>
                {serverPacketPdf ? (
                  <Link
                    href={`/api/decisions/${id}/packet-runs/${p.id}?format=pdf`}
                    className="ui-link text-xs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Server PDF
                  </Link>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Recent events</p>
        <div className="mt-3 space-y-3">
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No events yet.</p>
          ) : (
            (events ?? []).map((event) => (
              <div key={event.id} className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-sm">
                <p className="font-medium text-[var(--text-primary)]">{event.event_type}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
