import type { AdminClient } from "@/lib/v6/service";

function logQueryError(context: string, error: unknown) {
  console.error(`[operations-settings] ${context}`, error);
}

/** JSON-serializable payload for the client workflow settings shell. */
export type OperationsSettingsPayload = {
  rules: Array<{
    id: string;
    name: string;
    trigger_type: string;
    active: boolean;
  }>;
  playbooks: Array<{
    id: string;
    contract_type: string | null;
    task_key: string;
    label: string;
    offset_days: number;
    active: boolean;
  }>;
  templates: Array<{
    id: string;
    contract_type: string;
    title: string;
    obligation_type: string;
    cadence: string | null;
    due_offset_days: number | null;
    active: boolean;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    events: string[] | null;
    active: boolean;
    created_at?: string;
  }>;
  fieldTemplates: Array<{
    id: string;
    contract_type: string | null;
    field_name: string;
    required: boolean;
    active: boolean;
  }>;
  reminderTemplates: Array<{
    id: string;
    contract_type: string | null;
    field_name: string;
    offset_days: number;
    reminder_type: string;
    active: boolean;
  }>;
  taskTemplates: Array<{
    id: string;
    contract_type: string | null;
    team_key: string | null;
    title: string;
    due_offset_days: number;
    priority: string;
    active: boolean;
  }>;
  integrations: Array<{
    id: string;
    provider: string;
    status: string;
    last_synced_at: string | null;
    last_error: string | null;
  }>;
  workflowSettings: {
    weekly_intake_lookback_days: number | null;
    renewal_horizon_days: number | null;
    stale_contract_days: number | null;
    stale_ownership_days: number | null;
    notification_policy_json: unknown;
    role_policy_json: unknown;
    dashboard_tracking_enabled: boolean | null;
  } | null;
  approvalPolicies: Array<{
    id: string;
    approval_type: string;
    min_annual_value: number | string | null;
    contract_type: string | null;
    required_approver_id: string | null;
    active: boolean;
  }>;
  memberOptions: Array<{ id: string; label: string }>;
  apiKeys: Array<{
    id: string;
    label: string;
    key_prefix: string;
    active: boolean;
    scopes: string[] | null;
    expires_at: string | null;
    revoked_at: string | null;
    revoked_reason: string | null;
    last_used_at: string | null;
    created_at?: string;
  }>;
};

async function loadMemberOptions(admin: AdminClient, orgId: string): Promise<Array<{ id: string; label: string }>> {
  const { data: memberRows, error: e1 } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (e1) {
    logQueryError("organization_members", e1);
    return [];
  }
  const ids = [...new Set((memberRows ?? []).map((r) => r.user_id as string))];
  if (ids.length === 0) return [];

  const { data: profs, error: e2 } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
  if (e2) {
    logQueryError("profiles for members", e2);
    return (memberRows ?? []).map((row) => ({
      id: row.user_id as string,
      label: "Member",
    }));
  }
  const byId = new Map(
    (profs ?? []).map((p) => [p.id as string, { full_name: p.full_name as string | null, email: p.email as string | null }])
  );
  return (memberRows ?? []).map((row) => {
    const uid = row.user_id as string;
    const p = byId.get(uid);
    return { id: uid, label: p?.full_name || p?.email || "Member" };
  });
}

function stripForClient<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function loadOperationsSettingsData(
  admin: AdminClient,
  orgId: string
): Promise<OperationsSettingsPayload> {
  const [
    { data: rules, error: eRules },
    { data: playbooks, error: ePlay },
    { data: templates, error: eTpl },
    { data: webhooks, error: eWh },
    { data: fieldTemplates, error: eFt },
    { data: reminderTemplates, error: eRt },
    { data: taskTemplates, error: eTt },
    { data: integrations, error: eInt },
    { data: workflowSettings, error: eWs },
    { data: approvalPolicies, error: eAp },
    { data: apiKeys, error: eKeys },
  ] = await Promise.all([
    admin
      .from("task_automation_rules")
      .select("id, name, trigger_type, active, created_at")
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
      .from("integration_api_keys")
      .select("id, label, key_prefix, active, scopes, expires_at, revoked_at, revoked_reason, last_used_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  if (eRules) logQueryError("task_automation_rules", eRules);
  if (ePlay) logQueryError("renewal_playbook_templates", ePlay);
  if (eTpl) logQueryError("obligation_templates", eTpl);
  if (eWh) logQueryError("webhook_subscriptions", eWh);
  if (eFt) logQueryError("field_templates", eFt);
  if (eRt) logQueryError("reminder_templates", eRt);
  if (eTt) logQueryError("task_templates", eTt);
  if (eInt) logQueryError("integration_connections", eInt);
  if (eWs) logQueryError("organization_workflow_settings", eWs);
  if (eAp) logQueryError("approval_policies", eAp);
  if (eKeys) logQueryError("integration_api_keys", eKeys);

  const memberOptions = await loadMemberOptions(admin, orgId);

  const raw = {
    rules: rules ?? [],
    playbooks: playbooks ?? [],
    templates: templates ?? [],
    webhooks: webhooks ?? [],
    fieldTemplates: fieldTemplates ?? [],
    reminderTemplates: reminderTemplates ?? [],
    taskTemplates: taskTemplates ?? [],
    integrations: integrations ?? [],
    workflowSettings: workflowSettings ?? null,
    approvalPolicies: approvalPolicies ?? [],
    memberOptions,
    apiKeys: apiKeys ?? [],
  };

  return stripForClient(raw);
}
