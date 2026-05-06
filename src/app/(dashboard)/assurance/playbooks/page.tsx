import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { PlaybookApproveButton } from "@/components/assurance/playbook-approve-button";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";
import type { WorkspaceRole } from "@/lib/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function AssurancePlaybooksPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6AdaptivePlaybooks");
  const v6Outcomes = isFeatureEnabled("v6OutcomeIntelligence");

  const role = ctx.role as WorkspaceRole;
  const canApprove =
    role === "admin" || role === "manager" || role === "ops_manager" || role === "editor";

  const [{ data }, { data: pendingRuns }, { data: recentRuns }] = await Promise.all([
    ctx.admin
      .from("adaptive_playbooks")
      .select("id, name, playbook_type, approval_mode, active")
      .eq("organization_id", ctx.orgId)
      .order("updated_at", { ascending: false })
      .limit(50),
    ctx.admin
      .from("adaptive_playbook_runs")
      .select("id, adaptive_playbook_id, created_at, status")
      .eq("organization_id", ctx.orgId)
      .eq("status", "awaiting_approval")
      .order("created_at", { ascending: false })
      .limit(20),
    ctx.admin
      .from("adaptive_playbook_runs")
      .select("id, adaptive_playbook_id, created_at, status, completed_at, source_finding_id, success_assessment_json")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const runIds = (recentRuns ?? []).map((r) => String((r as { id: string }).id));
  type StepRow = {
    playbook_run_id: string;
    step_key: string;
    step_order: number;
    stage: string;
    status: string;
    completed_at?: string | null;
  };

  const { data: stepRows } =
    runIds.length > 0
      ? await ctx.admin
          .from("adaptive_playbook_steps")
          .select("playbook_run_id, step_key, step_order, stage, status, completed_at")
          .eq("organization_id", ctx.orgId)
          .in("playbook_run_id", runIds)
          .order("step_order", { ascending: true })
      : { data: [] as StepRow[] };

  const stepsByRun = new Map<string, StepRow[]>();
  for (const s of stepRows ?? []) {
    const row = s as StepRow;
    const rid = String(row.playbook_run_id);
    const list = stepsByRun.get(rid) ?? [];
    list.push(row);
    stepsByRun.set(rid, list);
  }

  const playbookName = new Map((data ?? []).map((p) => [String((p as { id: string }).id), String((p as { name: string }).name)]));

  return (
    <div className="ui-page-stack">
      <AssuranceListCard
        title="Adaptive playbooks"
        subtitle="Assurance"
        explainer={
          <>
            <p>
              Playbooks support preview, approval gates, execution, follow-up checks, and outcome assessment. Runs that
              require approval appear below.
            </p>
            <p className="ui-muted-tight mt-2 text-[12px]">
              This page loads up to 50 playbooks, up to 20 runs awaiting approval, and 12 recent runs (newest first).
              Use APIs or detail views for full history.
            </p>
          </>
        }
      >
        {(data ?? []).length === 0 ? (
          <EmptyState
            title="No playbooks yet"
            copy="Adaptive playbooks will appear here once defined for your organization."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {(data ?? []).map((row) => (
              <li key={row.id} className="ui-operational-card p-4">
                <p className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{row.name}</p>
                <p className="ui-support-copy mt-1">
                  {row.playbook_type} · approval {row.approval_mode} · {row.active ? "active" : "inactive"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AssuranceListCard>

      <AssuranceListCard
        title="Recent runs"
        subtitle="History"
        explainer={<p>Latest playbook executions with staged steps (eligibility through postmortem when recorded).</p>}
      >
        <ul className="space-y-4 text-sm">
          {(recentRuns ?? []).map((run) => {
            const rid = String((run as { id: string }).id);
            const pid = String((run as { adaptive_playbook_id: string }).adaptive_playbook_id);
            const steps = stepsByRun.get(rid) ?? [];
            return (
              <li key={rid} className="ui-operational-card p-4">
                <p className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {playbookName.get(pid) ?? "Playbook"} · {(run as { status: string }).status}
                </p>
                <p className="ui-support-copy mt-1">
                  Run <span className="font-mono">{rid.slice(0, 8)}…</span> · {String((run as { created_at: string }).created_at)}
                  {(run as { source_finding_id?: string | null }).source_finding_id ? (
                    <>
                      {" "}
                      · finding{" "}
                      <Link
                        className="ui-link font-mono"
                        href={`/assurance/findings/${String((run as { source_finding_id: string }).source_finding_id)}`}
                      >
                        open
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  <ApiJsonLink
                    className="ui-link"
                    href={`/api/playbooks/runs/${encodeURIComponent(rid)}`}
                  >
                    Run JSON
                  </ApiJsonLink>
                </p>
                {steps.length > 0 ? (
                  <ol className="mt-3 space-y-1 border-l-2 border-[var(--border-subtle)] pl-3 text-xs text-[var(--text-secondary)]">
                    {steps.map((step) => (
                      <li key={`${rid}-${step.step_key}`}>
                        <span className="font-medium text-[var(--text-primary)]">{step.stage}</span> · {step.step_key} ·{" "}
                        {step.status}
                        {step.completed_at ? ` · ${step.completed_at}` : ""}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">No step rows stored for this run yet.</p>
                )}
                {(run as { success_assessment_json?: unknown }).success_assessment_json != null &&
                typeof (run as { success_assessment_json?: unknown }).success_assessment_json === "object" &&
                Object.keys((run as { success_assessment_json: object }).success_assessment_json).length > 0 ? (
                  <div className="ui-alert-success mt-3 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide">
                      Success / assessment (post-run)
                    </p>
                    <pre className="mt-1 max-h-24 overflow-auto text-[10px] text-[var(--text-secondary)]">
                      {JSON.stringify((run as { success_assessment_json: unknown }).success_assessment_json, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </li>
            );
          })}
          {(recentRuns ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No runs yet.</li> : null}
        </ul>
        <p className="mt-4 text-xs text-[var(--text-secondary)]">
          <ApiJsonLink className="ui-link" href="/api/playbooks">
            Playbooks JSON
          </ApiJsonLink>
          {" · "}
          <ApiJsonLink className="ui-link" href="/api/assurance/check-runs?limit=40">
            Check runs JSON
          </ApiJsonLink>
          {" · "}
          <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
            Analytics summary
          </ApiJsonLink>
        </p>
      </AssuranceListCard>

      <AssuranceListCard
        title="Awaiting approval"
        subtitle="Playbook runs"
        explainer={<p>Approve gated runs to execute side effects. Uses POST /api/playbooks/runs/&#123;id&#125;/approve.</p>}
      >
        <ul className="space-y-3 text-sm">
          {(pendingRuns ?? []).map((run) => (
            <li key={run.id} className="ui-alert-warning p-4">
              <p className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Run {String(run.id).slice(0, 8)}…</p>
              <p className="ui-support-copy mt-1">
                Playbook {String(run.adaptive_playbook_id).slice(0, 8)}… · {String(run.created_at)}
              </p>
              {canApprove ? <PlaybookApproveButton runId={String(run.id)} /> : null}
              {!canApprove ? (
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">Your role cannot approve playbook runs.</p>
              ) : null}
            </li>
          ))}
          {(pendingRuns ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No runs waiting for approval.</li> : null}
        </ul>
      </AssuranceListCard>

      {v6Outcomes ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          Completed runs feed outcome intelligence analyses.{" "}
          <ApiJsonLink className="ui-link" href="/api/outcomes/interventions?limit=20&offset=0">
            Interventions JSON
          </ApiJsonLink>
          {" · "}
          <Link className="ui-link" href="/reports#outcome-intelligence">
            Outcome intelligence in reports
          </Link>
        </p>
      ) : null}
    </div>
  );
}
