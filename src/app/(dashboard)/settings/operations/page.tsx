import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import {
  createTaskAutomationRuleForm,
  toggleTaskAutomationRuleForm,
} from "@/actions/automation";
import {
  createApprovalPolicyForm,
  createFieldTemplateForm,
  createIntegrationApiKey,
  revokeIntegrationApiKeyForm,
  createReminderTemplateForm,
  createRenewalPlaybookTemplateForm,
  createTaskTemplateForm,
  createWebhookSubscriptionForm,
  setIntegrationTokenForm,
  toggleApprovalPolicyForm,
  toggleRenewalPlaybookTemplateForm,
  toggleWebhookSubscriptionForm,
  updateIntegrationApiKeyPolicyForm,
  upsertWorkflowSettingsForm,
  upsertIntegrationConnectionForm,
  applyPolicyPackForm,
} from "@/actions/workflow-config";
import { createObligationTemplateForm } from "@/actions/obligations";
import { cookies } from "next/headers";

export default async function OperationsSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;
  const cookieStore = await cookies();
  const newlyIssuedApiKey = cookieStore.get("contractops_new_api_key_token")?.value ?? null;

  const [
    { data: rules },
    { data: playbooks },
    { data: templates },
    { data: webhooks },
    { data: fieldTemplates },
    { data: reminderTemplates },
    { data: taskTemplates },
    { data: integrations },
    { data: workflowSettings },
    { data: approvalPolicies },
    { data: members },
    { data: apiKeys },
  ] =
    await Promise.all([
      admin
        .from("task_automation_rules")
        .select("id, name, trigger_type, active, config_json, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("renewal_playbook_templates")
        .select("id, contract_type, task_key, label, offset_days, active")
        .eq("organization_id", orgId)
        .order("offset_days", { ascending: false }),
      admin
        .from("obligation_templates")
        .select("id, contract_type, title, obligation_type, cadence, due_offset_days, active")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("webhook_subscriptions")
        .select("id, url, events, active, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("field_templates")
        .select("id, contract_type, field_name, required, active")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("reminder_templates")
        .select("id, contract_type, field_name, offset_days, reminder_type, active")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("task_templates")
        .select("id, contract_type, team_key, title, due_offset_days, priority, active")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("integration_connections")
        .select("id, provider, status, last_synced_at, last_error")
        .eq("organization_id", orgId)
        .order("provider", { ascending: true }),
      admin
        .from("organization_workflow_settings")
        .select(
          "weekly_intake_lookback_days, renewal_horizon_days, stale_contract_days, stale_ownership_days, notification_policy_json, role_policy_json, dashboard_tracking_enabled"
        )
        .eq("organization_id", orgId)
        .maybeSingle(),
      admin
        .from("approval_policies")
        .select("id, approval_type, min_annual_value, contract_type, required_approver_id, active")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("organization_members")
        .select("user_id, profiles(full_name, email)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true }),
      admin
        .from("integration_api_keys")
        .select("id, label, key_prefix, active, scopes, expires_at, revoked_at, revoked_reason, last_used_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
    ]);
  const memberOptions = (members ?? []).map((row) => {
    const p = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return { id: row.user_id, label: p?.full_name || p?.email || "Member" };
  });

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Operations</p>
        <h1 className="ui-display-title mt-2">Workflow configuration</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Configure task rules, renewal playbooks, obligation templates, and outbound webhooks.
        </p>
      </header>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Task automation rules</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createTaskAutomationRuleForm} className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Missing notice window follow-up" className="ui-input" />
            <select name="triggerType" defaultValue="field_missing" className="ui-input">
              <option value="field_missing">field_missing</option>
              <option value="field_changed">field_changed</option>
              <option value="date_window">date_window</option>
              <option value="ownership_change">ownership_change</option>
              <option value="renewal_window">renewal_window</option>
              <option value="approval_stall">approval_stall</option>
              <option value="risk_threshold">risk_threshold</option>
              <option value="data_quality_gap">data_quality_gap</option>
            </select>
            <input name="requiredField" placeholder="notice_window" className="ui-input" />
            <input name="fieldName" placeholder="renewal_date / end_date" className="ui-input" />
            <input name="windowDays" type="number" min={0} defaultValue={30} className="ui-input" />
            <input name="lookbackDays" type="number" min={1} defaultValue={2} className="ui-input" />
            <input name="teamKey" placeholder="ops" className="ui-input" />
            <input name="dueInDays" type="number" min={0} defaultValue={3} className="ui-input" />
            <input
              name="stallHours"
              type="number"
              min={1}
              defaultValue={24}
              placeholder="approval stall hours"
              className="ui-input"
            />
            <input
              name="minCompleteness"
              type="number"
              min={0}
              max={100}
              defaultValue={80}
              placeholder="min completeness score"
              className="ui-input"
            />
            <input name="taskTitle" placeholder="Fill missing notice window" className="ui-input" />
            <input
              name="webhookEventType"
              placeholder="optional webhook event type"
              className="ui-input"
            />
            <select name="actionType" defaultValue="create_task" className="ui-input">
              <option value="create_task">create_task</option>
              <option value="notify_only">notify_only</option>
              <option value="trigger_report">trigger_report</option>
            </select>
            <select name="reportMode" defaultValue="exceptions" className="ui-input">
              <option value="exceptions">exceptions</option>
              <option value="management">management</option>
              <option value="saved_view">saved_view</option>
            </select>
            <textarea
              name="taskDetails"
              placeholder="Prompt owner to confirm clause and update field."
              className="ui-input md:col-span-2 min-h-[70px]"
            />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Create rule
            </button>
          </form>
          <ul className="space-y-2">
            {(rules ?? []).map((rule) => (
              <li key={rule.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <span>
                  {rule.name} · {rule.trigger_type}
                </span>
                <form action={toggleTaskAutomationRuleForm.bind(null, rule.id, !rule.active)}>
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    {rule.active ? "Disable" : "Enable"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Policy packs</h2>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-zinc-500">
            Apply a preset package of workflow thresholds and required field coverage.
          </p>
          <form action={applyPolicyPackForm} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select name="policyPack" defaultValue="balanced" className="ui-input max-w-xs">
              <option value="balanced">Balanced operations</option>
              <option value="compliance">Compliance-heavy</option>
              <option value="revenue">Revenue-first</option>
            </select>
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
              Apply policy pack
            </button>
          </form>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Workflow cadence settings</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={upsertWorkflowSettingsForm} className="grid gap-3 md:grid-cols-2">
            <input
              name="weeklyIntakeLookbackDays"
              type="number"
              min={1}
              max={30}
              defaultValue={workflowSettings?.weekly_intake_lookback_days ?? 7}
              className="ui-input"
            />
            <input
              name="renewalHorizonDays"
              type="number"
              min={30}
              max={365}
              defaultValue={workflowSettings?.renewal_horizon_days ?? 90}
              className="ui-input"
            />
            <input
              name="staleContractDays"
              type="number"
              min={30}
              max={365}
              defaultValue={workflowSettings?.stale_contract_days ?? 120}
              className="ui-input"
            />
            <input
              name="staleOwnershipDays"
              type="number"
              min={14}
              max={365}
              defaultValue={workflowSettings?.stale_ownership_days ?? 90}
              className="ui-input"
            />
            <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                name="emailEnabled"
                value="1"
                defaultChecked={
                  ((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.email as Record<string, unknown> | undefined)?.enabled !==
                  false
                }
              />
              Email notifications enabled
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                name="slackEnabled"
                value="1"
                defaultChecked={
                  ((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.slack as Record<string, unknown> | undefined)?.enabled !==
                  false
                }
              />
              Slack notifications enabled
            </label>
            <input
              name="emailQuietStartUtc"
              type="number"
              min={0}
              max={23}
              defaultValue={
                Number(
                  ((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.email as Record<string, unknown> | undefined)
                    ?.quiet_hours_start_utc ?? 0
                )
              }
              className="ui-input"
            />
            <input
              name="emailQuietEndUtc"
              type="number"
              min={0}
              max={23}
              defaultValue={
                Number(
                  ((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.email as Record<string, unknown> | undefined)
                    ?.quiet_hours_end_utc ?? 0
                )
              }
              className="ui-input"
            />
            <input
              name="slackQuietStartUtc"
              type="number"
              min={0}
              max={23}
              defaultValue={
                Number(
                  ((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.slack as Record<string, unknown> | undefined)
                    ?.quiet_hours_start_utc ?? 0
                )
              }
              className="ui-input"
            />
            <input
              name="slackQuietEndUtc"
              type="number"
              min={0}
              max={23}
              defaultValue={
                Number(
                  ((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.slack as Record<string, unknown> | undefined)
                    ?.quiet_hours_end_utc ?? 0
                )
              }
              className="ui-input"
            />
            <input
              name="emailBlockedTypes"
              placeholder="email blocked types (comma-separated)"
              defaultValue={(
                (((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.email as
                  | Record<string, unknown>
                  | undefined)?.blocked_types as string[] | undefined) ?? []
              ).join(", ")}
              className="ui-input md:col-span-2"
            />
            <input
              name="slackBlockedTypes"
              placeholder="slack blocked types (comma-separated)"
              defaultValue={(
                (((workflowSettings?.notification_policy_json as Record<string, unknown> | null)?.slack as
                  | Record<string, unknown>
                  | undefined)?.blocked_types as string[] | undefined) ?? []
              ).join(", ")}
              className="ui-input md:col-span-2"
            />
            <label className="inline-flex items-center gap-2 text-sm text-zinc-600 md:col-span-2">
              <input
                type="checkbox"
                name="dashboardTrackingEnabled"
                value="1"
                defaultChecked={workflowSettings?.dashboard_tracking_enabled !== false}
              />
              Enable dashboard usage tracking
            </label>
            <textarea
              name="rolePolicyJson"
              placeholder='{"ops_manager":{"approvals_manage":false},"legal_reviewer":{"approvals_manage":true}}'
              defaultValue={JSON.stringify((workflowSettings?.role_policy_json as Record<string, unknown> | null) ?? {}, null, 2)}
              className="ui-input min-h-[90px] md:col-span-2"
            />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Save workflow settings
            </button>
          </form>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Field templates</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createFieldTemplateForm} className="grid gap-3 md:grid-cols-2">
            <input name="contractType" placeholder="MSA (optional)" className="ui-input" />
            <input name="fieldName" required placeholder="payment_cadence" className="ui-input" />
            <input name="defaultValue" placeholder="net_30" className="ui-input" />
            <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" name="required" value="1" className="h-4 w-4 rounded border-zinc-300" />
              Required field
            </label>
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add field template
            </button>
          </form>
          <ul className="space-y-2">
            {(fieldTemplates ?? []).map((t) => (
              <li key={t.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                {t.field_name} · {t.contract_type || "default"} · {t.required ? "required" : "optional"}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Approval policies</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createApprovalPolicyForm} className="grid gap-3 md:grid-cols-2">
            <select name="approvalType" defaultValue="renewal_decision" className="ui-input">
              <option value="renewal_decision">renewal_decision</option>
              <option value="notice_action">notice_action</option>
              <option value="commercial_exception">commercial_exception</option>
              <option value="ownership_handoff">ownership_handoff</option>
            </select>
            <input name="contractType" placeholder="MSA (optional)" className="ui-input" />
            <input name="minAnnualValue" type="number" min={0} placeholder="100000" className="ui-input" />
            <select name="requiredApproverId" className="ui-input">
              <option value="">No forced approver</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add approval policy
            </button>
          </form>
          <ul className="space-y-2">
            {(approvalPolicies ?? []).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <span>
                  {row.approval_type}
                  {row.contract_type ? ` · ${row.contract_type}` : " · any type"}
                  {row.min_annual_value != null ? ` · >=$${Number(row.min_annual_value).toLocaleString()}` : ""}
                </span>
                <form action={toggleApprovalPolicyForm.bind(null, row.id, !row.active)}>
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    {row.active ? "Disable" : "Enable"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Reminder templates</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createReminderTemplateForm} className="grid gap-3 md:grid-cols-2">
            <input name="contractType" placeholder="MSA (optional)" className="ui-input" />
            <input name="fieldName" required placeholder="renewal_date" className="ui-input" />
            <input name="reminderType" required placeholder="renewal_30d" className="ui-input" />
            <input name="offsetDays" type="number" min={0} defaultValue={30} className="ui-input" />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add reminder template
            </button>
          </form>
          <ul className="space-y-2">
            {(reminderTemplates ?? []).map((t) => (
              <li key={t.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                {t.field_name} · {t.offset_days}d · {t.reminder_type}
                {t.contract_type ? ` · ${t.contract_type}` : " · default"}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Task templates</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createTaskTemplateForm} className="grid gap-3 md:grid-cols-2">
            <input name="contractType" placeholder="MSA (optional)" className="ui-input" />
            <input name="teamKey" placeholder="ops" className="ui-input" />
            <input name="title" required placeholder="Prepare renewal strategy memo" className="ui-input" />
            <input name="dueOffsetDays" type="number" min={0} defaultValue={7} className="ui-input" />
            <select name="priority" defaultValue="medium" className="ui-input">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <textarea name="details" className="ui-input min-h-[70px] md:col-span-2" placeholder="Expected deliverable and owner guidance." />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add task template
            </button>
          </form>
          <ul className="space-y-2">
            {(taskTemplates ?? []).map((t) => (
              <li key={t.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                {t.title} · {t.priority} · due+{t.due_offset_days}d
                {t.team_key ? ` · ${t.team_key}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Renewal playbook templates</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createRenewalPlaybookTemplateForm} className="grid gap-3 md:grid-cols-2">
            <input name="taskKey" required placeholder="r045_exec_alignment" className="ui-input" />
            <input name="label" required placeholder="Align leadership decision and owner" className="ui-input" />
            <input name="offsetDays" type="number" min={0} required placeholder="45" className="ui-input" />
            <input name="contractType" placeholder="MSA (optional)" className="ui-input" />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add playbook step
            </button>
          </form>
          <ul className="space-y-2">
            {(playbooks ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <span>
                  {row.offset_days}d · {row.label}
                  {row.contract_type ? ` · ${row.contract_type}` : " · default"}
                </span>
                <form action={toggleRenewalPlaybookTemplateForm.bind(null, row.id, !row.active)}>
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    {row.active ? "Disable" : "Enable"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Integration connections</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={upsertIntegrationConnectionForm} className="grid gap-3 md:grid-cols-2">
            <select name="provider" defaultValue="google_calendar" className="ui-input">
              <option value="google_calendar">google_calendar</option>
              <option value="outlook_calendar">outlook_calendar</option>
              <option value="slack">slack</option>
              <option value="email">email</option>
              <option value="crm">crm</option>
            </select>
            <select name="status" defaultValue="connected" className="ui-input">
              <option value="not_connected">not_connected</option>
              <option value="connected">connected</option>
              <option value="error">error</option>
            </select>
            <input
              name="configJson"
              placeholder='{"channel":"#contract-ops"}'
              className="ui-input md:col-span-2"
            />
            <input name="lastError" placeholder="Error details (optional)" className="ui-input md:col-span-2" />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Save integration state
            </button>
          </form>
          <form action={setIntegrationTokenForm} className="grid gap-3 border-t border-zinc-100 pt-4 md:grid-cols-2">
            <select name="provider" defaultValue="google_calendar" className="ui-input">
              <option value="google_calendar">google_calendar</option>
              <option value="outlook_calendar">outlook_calendar</option>
              <option value="slack">slack</option>
              <option value="email">email</option>
              <option value="crm">crm</option>
            </select>
            <input name="connectedAccount" placeholder="account@vendor.com" className="ui-input" />
            <input name="accessToken" placeholder="access token" className="ui-input md:col-span-2" />
            <input name="refreshToken" placeholder="refresh token (optional)" className="ui-input md:col-span-2" />
            <input name="tokenExpiresAt" placeholder="2026-12-31T00:00:00Z" className="ui-input md:col-span-2" />
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px] md:col-span-2">
              Save integration token lifecycle
            </button>
          </form>
          <ul className="space-y-2">
            {(integrations ?? []).map((row) => (
              <li key={row.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                {row.provider} · {row.status}
                {row.last_synced_at ? ` · synced ${new Date(row.last_synced_at).toLocaleDateString()}` : ""}
                {row.last_error ? ` · ${row.last_error}` : ""}
              </li>
            ))}
          </ul>
          <div className="border-t border-zinc-100 pt-4">
            <p className="ui-label-caps">Integration API keys</p>
            {newlyIssuedApiKey && (
              <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold">Copy this API key now. It will not be shown again.</p>
                <p className="mt-1 break-all font-mono">{newlyIssuedApiKey}</p>
              </div>
            )}
            <form
              action={async (formData) => {
                "use server";
                const cookieStore = await cookies();
                const label = String(formData.get("label") ?? "").trim();
                const scopesRaw = String(formData.get("scopes") ?? "").trim();
                const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
                if (!label) return;
                const res = await createIntegrationApiKey({
                  organizationId: orgId,
                  label,
                  scopes: scopesRaw
                    .split(",")
                    .map((scope) => scope.trim())
                    .filter(Boolean),
                  expiresAt: expiresAtRaw || null,
                });
                if (res && "error" in res && res.error) {
                  console.error("[workflow-config] createIntegrationApiKey", res.error);
                } else if (res && "success" in res && res.success) {
                  cookieStore.set("contractops_new_api_key_token", res.token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    maxAge: 300,
                    path: "/settings/operations",
                  });
                }
              }}
              className="mt-2 grid gap-2 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,1fr)_auto]"
            >
              <input name="label" required placeholder="Events consumer key" className="ui-input min-w-[16rem]" />
              <input name="scopes" defaultValue="events:read" placeholder="events:read" className="ui-input" />
              <input name="expiresAt" type="datetime-local" className="ui-input" />
              <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
                Create API key
              </button>
            </form>
            <ul className="mt-3 space-y-2 text-xs text-zinc-600">
              {(apiKeys ?? []).map((key) => (
                <li key={key.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="font-semibold text-zinc-800">
                    {key.label} · {key.key_prefix} · {key.active ? "active" : "inactive"}
                  </p>
                  <p className="mt-1 text-zinc-600">
                    Scopes: {(key.scopes ?? []).join(", ") || "events:read"}
                    {key.expires_at
                      ? ` · expires ${new Date(key.expires_at).toLocaleString()}`
                      : " · no expiry"}
                    {key.last_used_at
                      ? ` · last used ${new Date(key.last_used_at).toLocaleDateString()}`
                      : ""}
                  </p>
                  {key.revoked_at && (
                    <p className="mt-1 text-rose-700">
                      Revoked {new Date(key.revoked_at).toLocaleString()}
                      {key.revoked_reason ? ` · ${key.revoked_reason}` : ""}
                    </p>
                  )}
                  {!key.revoked_at && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={updateIntegrationApiKeyPolicyForm} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="keyId" value={key.id} />
                        <input
                          name="scopes"
                          defaultValue={(key.scopes ?? ["events:read"]).join(",")}
                          className="ui-input h-8 min-w-[10rem] text-[11px]"
                        />
                        <input
                          name="expiresAt"
                          type="datetime-local"
                          defaultValue={key.expires_at ? new Date(key.expires_at).toISOString().slice(0, 16) : ""}
                          className="ui-input h-8 text-[11px]"
                        />
                        <label className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
                          <input type="checkbox" name="active" value="1" defaultChecked={key.active} />
                          active
                        </label>
                        <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                          Save policy
                        </button>
                      </form>
                      <form action={revokeIntegrationApiKeyForm} className="flex items-center gap-1.5">
                        <input type="hidden" name="keyId" value={key.id} />
                        <input
                          name="reason"
                          placeholder="revoke reason"
                          className="ui-input h-8 min-w-[10rem] text-[11px]"
                        />
                        <button type="submit" className="ui-btn-danger px-2 py-1 text-[11px]">
                          Revoke
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Obligation templates</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createObligationTemplateForm} className="grid gap-3 md:grid-cols-2">
            <input name="contractType" required placeholder="MSA" className="ui-input" />
            <input name="title" required placeholder="Quarterly usage report" className="ui-input" />
            <input name="obligationType" placeholder="reporting" className="ui-input" />
            <input name="cadence" placeholder="quarterly" className="ui-input" />
            <input name="dueOffsetDays" type="number" min={0} placeholder="30" className="ui-input" />
            <textarea name="details" placeholder="Evidence and delivery requirements." className="ui-input md:col-span-2 min-h-[70px]" />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add template
            </button>
          </form>
          <ul className="space-y-2">
            {(templates ?? []).map((t) => (
              <li key={t.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                {t.contract_type} · {t.title} · {t.obligation_type}
                {t.cadence ? ` · ${t.cadence}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Webhook subscriptions</h2>
        </div>
        <div className="space-y-4 p-6">
          <form action={createWebhookSubscriptionForm} className="grid gap-3 md:grid-cols-2">
            <input name="url" required placeholder="https://your-system.example/webhooks" className="ui-input md:col-span-2" />
            <input name="secret" required placeholder="webhook signing secret" className="ui-input" />
            <input name="events" placeholder="contract.created,reminder.due" className="ui-input" />
            <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
              Add webhook
            </button>
          </form>
          <ul className="space-y-2">
            {(webhooks ?? []).map((wh) => (
              <li key={wh.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <span className="truncate pr-3">{wh.url}</span>
                <form action={toggleWebhookSubscriptionForm.bind(null, wh.id, !wh.active)}>
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    {wh.active ? "Disable" : "Enable"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <Link href="/settings" className="ui-link text-sm">
            Back to settings
          </Link>
        </div>
      </section>
    </div>
  );
}
