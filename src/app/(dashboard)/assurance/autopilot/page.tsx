import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { AutopilotDisableButton, AutopilotRulePatchForm } from "@/components/assurance/autopilot-rule-patch";
import { AutopilotRevertLogButton } from "@/components/assurance/autopilot-revert-log-button";
import { OrgV6SettingsPanel } from "@/components/assurance/org-v6-settings-panel";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";
import type { WorkspaceRole } from "@/lib/navigation";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import type { V6OrgSettingsJson } from "@/lib/v6/org-settings";

export default async function AssuranceAutopilotPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6Autopilot");

  const role = ctx.role as WorkspaceRole;
  const canManage = role === "admin" || role === "manager" || role === "ops_manager";

  const [{ data: rules }, { data: logs }, { data: orgRow }] = await Promise.all([
    ctx.admin
      .from("autopilot_rules")
      .select(
        "id, name, action_type, enabled, requires_approval, dry_run_count, allowlist_json, guardrails_json, updated_at"
      )
      .eq("organization_id", ctx.orgId)
      .order("updated_at", { ascending: false })
      .limit(40),
    ctx.admin
      .from("autopilot_run_logs")
      .select("id, status, action_type, reason, created_at, output_json")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    ctx.admin.from("organizations").select("v6_org_settings_json").eq("id", ctx.orgId).maybeSingle(),
  ]);

  const orgSettings = (orgRow?.v6_org_settings_json ?? {}) as {
    autopilot_allow_execution?: boolean;
    review_board_notification_emails?: string[];
  };
  const workspaceMode = parseWorkspaceMode((orgRow?.v6_org_settings_json ?? {}) as V6OrgSettingsJson);
  const mutatingExecutionEnabled =
    workspaceMode === "assurance" && orgSettings.autopilot_allow_execution === true;

  const logStats = { blocked: 0, failed: 0, reverted: 0, dry_run: 0, executed: 0 };
  for (const row of logs ?? []) {
    const s = String((row as { status: string }).status);
    if (s === "blocked") logStats.blocked += 1;
    else if (s === "failed") logStats.failed += 1;
    else if (s === "reverted") logStats.reverted += 1;
    else if (s === "dry_run") logStats.dry_run += 1;
    else if (s === "executed") logStats.executed += 1;
  }

  return (
    <div className="ui-page-stack">
      {!mutatingExecutionEnabled ? (
        <div className="ui-status-panel ui-status-panel-warning text-sm">
          <p className="font-semibold">Dry-run posture</p>
          <p className="mt-1 text-[12.5px] leading-relaxed">
            Mutating autopilot execution is off for this workspace. Rules may still evaluate and log dry-runs; turn on
            execution under Settings → Product experience when you are in Assurance mode and ready for bounded actions.
          </p>
        </div>
      ) : null}
      <AssuranceListCard
        title="Safe autopilot"
        subtitle="Assurance"
        explainer={
          <p>
            Rules are bounded by allowlists, approval gates, and dry-run history. When control policies use{" "}
            <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">trigger_autopilot_action</code>, enforcement prefers a rule
            whose <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">guardrails_json.policy_id</code> matches the breached
            policy; otherwise the newest enabled rule is used. Execution can be disabled globally (dry-runs still
            run) or per organization below. Manage rules via{" "}
            <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">GET/POST /api/autopilot/rules</code>.
          </p>
        }
      >
        <OrgV6SettingsPanel
          canManage={canManage}
          initialAutopilotAllowExecution={orgSettings.autopilot_allow_execution ?? null}
          initialEmails={Array.isArray(orgSettings.review_board_notification_emails) ? orgSettings.review_board_notification_emails : []}
        />
        <ul className="space-y-2 text-sm">
          {(rules ?? []).map((row) => (
            <li key={row.id} className="ui-support-panel p-3">
              <p className="font-medium text-[var(--text-primary)]">{row.name}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {row.action_type} · {row.enabled ? "enabled" : "disabled"} · dry-runs {row.dry_run_count}
                {row.guardrails_json &&
                typeof row.guardrails_json === "object" &&
                row.guardrails_json !== null &&
                "policy_id" in row.guardrails_json ? (
                  <span className="ml-1 text-[var(--text-tertiary)]">
                    · policy{" "}
                    <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-0.5">
                      {String((row.guardrails_json as { policy_id?: string }).policy_id ?? "")}
                    </code>
                  </span>
                ) : null}
              </p>
              {canManage && row.enabled ? (
                <>
                  <AutopilotRulePatchForm
                    ruleId={String(row.id)}
                    initialAllowlist={
                      Array.isArray(row.allowlist_json)
                        ? (row.allowlist_json as string[])
                        : []
                    }
                  />
                  <AutopilotDisableButton ruleId={String(row.id)} />
                </>
              ) : null}
            </li>
          ))}
          {(rules ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No autopilot rules yet.</li> : null}
        </ul>
      </AssuranceListCard>

      <AssuranceListCard
        title="Recent run logs"
        subtitle="Autopilot"
        explainer={
          <p>
            Audit trail for dry-runs, blocked actions, executions, and reverts. Blocked rows often indicate allowlist
            mismatch, organization disablement, or the global execution gate. Use this as an override and trust signal.
          </p>
        }
      >
        <div className="ui-soft-details mb-3 grid gap-2 p-3 text-xs text-[var(--text-secondary)] sm:grid-cols-3 lg:grid-cols-5">
          <p>
            <span className="font-semibold text-[var(--text-primary)]">{logStats.dry_run}</span> dry-run
          </p>
          <p>
            <span className="font-semibold text-[var(--text-primary)]">{logStats.executed}</span> executed
          </p>
          <p>
            <span className="font-semibold text-[var(--warning-ink)]">{logStats.blocked}</span> blocked
          </p>
          <p>
            <span className="font-semibold text-[var(--danger-ink)]">{logStats.failed}</span> failed
          </p>
          <p>
            <span className="font-semibold text-[var(--text-primary)]">{logStats.reverted}</span> reverted
          </p>
        </div>
        <ul className="space-y-2 text-sm">
          {(logs ?? []).map((row) => {
            const out = (row as { output_json?: Record<string, unknown> }).output_json ?? {};
            const hint = out.revert_hint as { table?: string; id?: string } | undefined;
            const canRevert =
              canManage &&
              row.status === "executed" &&
              Boolean(hint?.table && hint?.id);
            return (
              <li key={row.id} className="ui-support-panel p-3">
                <p className="font-medium text-[var(--text-primary)]">
                  {row.status} · {row.action_type}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{row.reason ?? "—"}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(row.created_at)}</p>
                {Object.keys(out).length > 0 ? (
                  <pre className="ui-soft-details mt-2 max-h-28 overflow-auto p-2 text-[11px] text-[var(--text-secondary)]">
                    {JSON.stringify(out, null, 2)}
                  </pre>
                ) : null}
                <AutopilotRevertLogButton logId={String(row.id)} canRevert={canRevert} />
              </li>
            );
          })}
          {(logs ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No runs yet.</li> : null}
        </ul>
        <p className="mt-4 text-xs text-[var(--text-secondary)]">
          <ApiJsonLink className="ui-link" href="/api/autopilot/rules">
            Rules JSON
          </ApiJsonLink>
          {" · "}
          <ApiJsonLink className="ui-link" href="/api/autopilot/runs">
            Run logs JSON
          </ApiJsonLink>
          {" · "}
          <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
            Analytics summary
          </ApiJsonLink>
          {" · "}
          <Link className="ui-link" href="/assurance">
            Back to assurance
          </Link>
        </p>
      </AssuranceListCard>
    </div>
  );
}
