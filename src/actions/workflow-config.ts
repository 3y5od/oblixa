"use server";

import {
  createAdminClient,
  createClient,
  getOrEnsureDeterministicMembership,
} from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { encryptIntegrationToken } from "@/lib/security/token-crypto";
import { isUuid } from "@/lib/security/validation";
import { sanitizeRolePolicyJson } from "@/lib/settings/sanitize-role-policy-json";
import { createHash, randomBytes } from "crypto";

async function getMembership(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  user: {
    id: string;
    user_metadata?: {
      full_name?: unknown;
    } | null;
  }
) {
  const data = await getOrEnsureDeterministicMembership(admin, user);
  return { data };
}

async function logTemplateChange(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    templateType: "field" | "reminder" | "task" | "playbook" | "obligation";
    templateId: string;
    action: "created" | "updated" | "toggled" | "applied";
    userId: string | null;
    details?: Record<string, unknown>;
  }
) {
  await admin.from("template_change_events").insert({
    organization_id: input.organizationId,
    template_type: input.templateType,
    template_id: input.templateId,
    action: input.action,
    created_by: input.userId,
    details: input.details ?? {},
  });
}

export async function createRenewalPlaybookTemplateForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = String(formData.get("taskKey") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const offsetDays = Number(String(formData.get("offsetDays") ?? "").trim() || "0");
  const contractType = String(formData.get("contractType") ?? "").trim() || null;
  if (!name || !label || !Number.isFinite(offsetDays) || offsetDays < 0)
    return { error: "Invalid playbook template input" };

  const { data: membership } = await getMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer"))
    return { error: "Access denied" };

  const { error } = await admin.from("renewal_playbook_templates").upsert(
    {
      organization_id: membership.organization_id,
      contract_type: contractType,
      task_key: name,
      label,
      offset_days: Math.trunc(offsetDays),
      active: true,
      created_by: user.id,
    },
    {
      onConflict: "organization_id,contract_type,task_key",
      ignoreDuplicates: false,
    }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  const { data: row } = await admin
    .from("renewal_playbook_templates")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("task_key", name)
    .is("contract_type", contractType)
    .maybeSingle();
  if (row?.id) {
    await logTemplateChange(admin, {
      organizationId: membership.organization_id,
      templateType: "playbook",
      templateId: row.id,
      action: "created",
      userId: user.id,
      details: { contract_type: contractType, task_key: name, offset_days: Math.trunc(offsetDays) },
    });
  }
  return { success: true };
}

export async function toggleRenewalPlaybookTemplate(templateId: string, active: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUuid(templateId)) return { error: "Invalid request" };

  const { data: tpl } = await admin
    .from("renewal_playbook_templates")
    .select("id, organization_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return { error: "Template not found" };
  const role = await getOrgMemberRole(admin, user.id, tpl.organization_id);
  if (!canEditContracts(role)) return { error: "Access denied" };
  const { error } = await admin.from("renewal_playbook_templates").update({ active }).eq("id", templateId);
  if (error) return { error: mapDataSourceError(error.message) };
  await logTemplateChange(admin, {
    organizationId: tpl.organization_id,
    templateType: "playbook",
    templateId,
    action: "toggled",
    userId: user.id,
    details: { active },
  });
  return { success: true };
}

export async function toggleRenewalPlaybookTemplateForm(
  templateId: string,
  active: boolean
) {
  return await toggleRenewalPlaybookTemplate(templateId, active);
}

export async function createWebhookSubscriptionForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const url = String(formData.get("url") ?? "").trim();
  const secret = String(formData.get("secret") ?? "").trim();
  const events = String(formData.get("events") ?? "").trim();
  if (!url || !secret) return { error: "URL and secret are required" };
  if (url && !/^https:\/\//i.test(url)) return { error: "Webhook URL must use HTTPS" };

  const parsedEvents = events
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };

  let encryptedSecret: string;
  try {
    encryptedSecret = encryptIntegrationToken(secret) ?? "";
  } catch {
    return { error: "Webhook secret encryption failed" };
  }
  if (!encryptedSecret) return { error: "Webhook secret encryption failed" };

  const { error } = await admin.from("webhook_subscriptions").insert({
    organization_id: membership.organization_id,
    url,
    secret: encryptedSecret,
    events: parsedEvents.length ? parsedEvents : ["contract.updated", "reminder.due"],
    active: true,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function toggleWebhookSubscription(id: string, active: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUuid(id)) return { error: "Invalid request" };

  const { data: sub } = await admin
    .from("webhook_subscriptions")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!sub) return { error: "Subscription not found" };

  const role = await getOrgMemberRole(admin, user.id, sub.organization_id);
  if (role !== "admin") return { error: "Access denied" };
  const { error } = await admin.from("webhook_subscriptions").update({ active }).eq("id", id);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function toggleWebhookSubscriptionForm(id: string, active: boolean) {
  return await toggleWebhookSubscription(id, active);
}

export async function createFieldTemplateForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const fieldName = String(formData.get("fieldName") ?? "").trim();
  const contractType = String(formData.get("contractType") ?? "").trim() || null;
  const defaultValue = String(formData.get("defaultValue") ?? "").trim() || null;
  const required = String(formData.get("required") ?? "") === "1";
  if (!fieldName) return { error: "Field name is required" };
  if (fieldName.length > 120) return { error: "Field name must be 120 characters or fewer" };
  if (defaultValue && defaultValue.length > 4000)
    return { error: "Default value must be 4000 characters or fewer" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer"))
    return { error: "Access denied" };
  const { error } = await admin.from("field_templates").upsert(
    {
      organization_id: membership.organization_id,
      contract_type: contractType,
      field_name: fieldName,
      default_value: defaultValue,
      required,
      active: true,
      created_by: user.id,
    },
    { onConflict: "organization_id,contract_type,field_name", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  const { data: row } = await admin
    .from("field_templates")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("field_name", fieldName)
    .is("contract_type", contractType)
    .maybeSingle();
  if (row?.id) {
    await logTemplateChange(admin, {
      organizationId: membership.organization_id,
      templateType: "field",
      templateId: row.id,
      action: "created",
      userId: user.id,
      details: { contract_type: contractType, required },
    });
  }
  return { success: true };
}

export async function createReminderTemplateForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const contractType = String(formData.get("contractType") ?? "").trim() || null;
  const fieldName = String(formData.get("fieldName") ?? "").trim();
  const reminderType = String(formData.get("reminderType") ?? "").trim();
  const offsetDays = Number(String(formData.get("offsetDays") ?? "").trim() || "0");
  if (!fieldName || !reminderType || !Number.isFinite(offsetDays) || offsetDays < 0)
    return { error: "Invalid reminder template input" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer"))
    return { error: "Access denied" };
  const { error } = await admin.from("reminder_templates").upsert(
    {
      organization_id: membership.organization_id,
      contract_type: contractType,
      field_name: fieldName,
      offset_days: Math.trunc(offsetDays),
      reminder_type: reminderType,
      active: true,
      created_by: user.id,
    },
    {
      onConflict: "organization_id,contract_type,field_name,offset_days,reminder_type",
      ignoreDuplicates: false,
    }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  const { data: row } = await admin
    .from("reminder_templates")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("field_name", fieldName)
    .eq("offset_days", Math.trunc(offsetDays))
    .eq("reminder_type", reminderType)
    .is("contract_type", contractType)
    .maybeSingle();
  if (row?.id) {
    await logTemplateChange(admin, {
      organizationId: membership.organization_id,
      templateType: "reminder",
      templateId: row.id,
      action: "created",
      userId: user.id,
      details: { contract_type: contractType },
    });
  }
  return { success: true };
}

export async function createTaskTemplateForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const contractType = String(formData.get("contractType") ?? "").trim() || null;
  const teamKey = String(formData.get("teamKey") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim() || null;
  const dueOffsetDays = Number(String(formData.get("dueOffsetDays") ?? "").trim() || "7");
  const priority = String(formData.get("priority") ?? "medium").trim();
  if (!title || !Number.isFinite(dueOffsetDays) || dueOffsetDays < 0)
    return { error: "Invalid task template input" };
  if (title.length > 240) return { error: "Task title must be 240 characters or fewer" };
  if (details && details.length > 4000)
    return { error: "Task details must be 4000 characters or fewer" };
  if (!["low", "medium", "high"].includes(priority))
    return { error: "Invalid priority" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer"))
    return { error: "Access denied" };
  const { data: row, error } = await admin
    .from("task_templates")
    .insert({
    organization_id: membership.organization_id,
    contract_type: contractType,
    team_key: teamKey,
    title,
    details,
    due_offset_days: Math.trunc(dueOffsetDays),
    priority,
    active: true,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };
  if (row?.id) {
    await logTemplateChange(admin, {
      organizationId: membership.organization_id,
      templateType: "task",
      templateId: row.id,
      action: "created",
      userId: user.id,
      details: { contract_type: contractType, priority },
    });
  }
  return { success: true };
}

export async function upsertIntegrationConnectionForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const provider = String(formData.get("provider") ?? "").trim();
  const status = String(formData.get("status") ?? "not_connected").trim();
  const config = String(formData.get("configJson") ?? "").trim();
  const lastError = String(formData.get("lastError") ?? "").trim() || null;
  if (!["google_calendar", "outlook_calendar", "slack", "email", "crm"].includes(provider))
    return { error: "Invalid provider" };
  if (!["not_connected", "connected", "error"].includes(status))
    return { error: "Invalid status" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  let configJson: Record<string, unknown> = {};
  if (config) {
    try {
      configJson = JSON.parse(config) as Record<string, unknown>;
    } catch {
      return { error: "Invalid configJson payload" };
    }
  }
  const { error } = await admin.from("integration_connections").upsert(
    {
      organization_id: membership.organization_id,
      provider,
      status,
      config_json: configJson,
      last_error: lastError,
      last_synced_at: status === "connected" ? new Date().toISOString() : null,
      created_by: user.id,
    },
    { onConflict: "organization_id,provider", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function upsertWorkflowSettingsForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const weeklyIntakeLookbackDays = Number(String(formData.get("weeklyIntakeLookbackDays") ?? "7"));
  const renewalHorizonDays = Number(String(formData.get("renewalHorizonDays") ?? "90"));
  const staleContractDays = Number(String(formData.get("staleContractDays") ?? "120"));
  const staleOwnershipDays = Number(String(formData.get("staleOwnershipDays") ?? "90"));
  const emailEnabled = formData.has("emailEnabled");
  const slackEnabled = formData.has("slackEnabled");
  const emailQuietStart = Number(String(formData.get("emailQuietStartUtc") ?? "").trim() || "0");
  const emailQuietEnd = Number(String(formData.get("emailQuietEndUtc") ?? "").trim() || "0");
  const slackQuietStart = Number(String(formData.get("slackQuietStartUtc") ?? "").trim() || "0");
  const slackQuietEnd = Number(String(formData.get("slackQuietEndUtc") ?? "").trim() || "0");
  const emailBlockedTypes = String(formData.get("emailBlockedTypes") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const slackBlockedTypes = String(formData.get("slackBlockedTypes") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const dashboardTrackingEnabled = formData.has("dashboardTrackingEnabled");
  const rolePolicyJsonRaw = String(formData.get("rolePolicyJson") ?? "").trim();
  if (
    !Number.isFinite(weeklyIntakeLookbackDays) ||
    !Number.isFinite(renewalHorizonDays) ||
    !Number.isFinite(staleContractDays) ||
    !Number.isFinite(staleOwnershipDays)
  ) {
    return { error: "Invalid numeric settings" };
  }
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  let rolePolicyJson: Record<string, unknown> = {};
  if (rolePolicyJsonRaw) {
    try {
      rolePolicyJson = sanitizeRolePolicyJson(JSON.parse(rolePolicyJsonRaw) as Record<string, unknown>);
    } catch {
      return { error: "Invalid rolePolicyJson payload" };
    }
  }
  const { error } = await admin.from("organization_workflow_settings").upsert(
    {
      organization_id: membership.organization_id,
      weekly_intake_lookback_days: Math.min(Math.max(Math.trunc(weeklyIntakeLookbackDays), 1), 30),
      renewal_horizon_days: Math.min(Math.max(Math.trunc(renewalHorizonDays), 30), 365),
      stale_contract_days: Math.min(Math.max(Math.trunc(staleContractDays), 30), 365),
      stale_ownership_days: Math.min(Math.max(Math.trunc(staleOwnershipDays), 14), 365),
      notification_policy_json: {
        email: {
          enabled: emailEnabled,
          quiet_hours_start_utc: Math.min(Math.max(Math.trunc(emailQuietStart), 0), 23),
          quiet_hours_end_utc: Math.min(Math.max(Math.trunc(emailQuietEnd), 0), 23),
          blocked_types: emailBlockedTypes,
        },
        slack: {
          enabled: slackEnabled,
          quiet_hours_start_utc: Math.min(Math.max(Math.trunc(slackQuietStart), 0), 23),
          quiet_hours_end_utc: Math.min(Math.max(Math.trunc(slackQuietEnd), 0), 23),
          blocked_types: slackBlockedTypes,
        },
      },
      role_policy_json: rolePolicyJson,
      dashboard_tracking_enabled: dashboardTrackingEnabled,
      created_by: user.id,
    },
    { onConflict: "organization_id", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function applyPolicyPackForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const policyPack = String(formData.get("policyPack") ?? "").trim();
  if (!["balanced", "compliance", "revenue"].includes(policyPack))
    return { error: "Invalid policy pack" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };

  const workflowByPack: Record<
    string,
    { renewal_horizon_days: number; stale_contract_days: number; stale_ownership_days: number }
  > = {
    balanced: { renewal_horizon_days: 90, stale_contract_days: 120, stale_ownership_days: 90 },
    compliance: { renewal_horizon_days: 120, stale_contract_days: 90, stale_ownership_days: 60 },
    revenue: { renewal_horizon_days: 180, stale_contract_days: 150, stale_ownership_days: 120 },
  };
  const requiredFieldsByPack: Record<string, string[]> = {
    balanced: ["end_date", "renewal_date", "notice_window"],
    compliance: ["end_date", "renewal_date", "notice_window", "governing_law", "liability_cap"],
    revenue: ["end_date", "renewal_date", "annual_value", "payment_terms"],
  };
  const preset = workflowByPack[policyPack];
  const { error: settingsError } = await admin.from("organization_workflow_settings").upsert(
    {
      organization_id: membership.organization_id,
      weekly_intake_lookback_days: 7,
      renewal_horizon_days: preset.renewal_horizon_days,
      stale_contract_days: preset.stale_contract_days,
      stale_ownership_days: preset.stale_ownership_days,
      created_by: user.id,
    },
    { onConflict: "organization_id", ignoreDuplicates: false }
  );
  if (settingsError) return { error: mapDataSourceError(settingsError.message) };
  for (const fieldName of requiredFieldsByPack[policyPack]) {
    const { error: fieldError } = await admin.from("field_templates").upsert(
      {
        organization_id: membership.organization_id,
        contract_type: null,
        field_name: fieldName,
        default_value: null,
        required: true,
        active: true,
        created_by: user.id,
      },
      { onConflict: "organization_id,contract_type,field_name", ignoreDuplicates: false }
    );
    if (fieldError) return { error: mapDataSourceError(fieldError.message) };
  }
  const { error: auditError } = await admin.from("audit_events").insert({
    organization_id: membership.organization_id,
    contract_id: null,
    user_id: user.id,
    action: "settings.policy_pack_applied",
    details: { policy_pack: policyPack },
  });
  if (auditError) return { error: mapDataSourceError(auditError.message) };
  return { success: true };
}

export async function createApprovalPolicyForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const approvalType = String(formData.get("approvalType") ?? "").trim();
  const minAnnualValueRaw = String(formData.get("minAnnualValue") ?? "").trim();
  const contractType = String(formData.get("contractType") ?? "").trim() || null;
  const requiredApproverId = String(formData.get("requiredApproverId") ?? "").trim() || null;
  if (!["renewal_decision", "notice_action", "commercial_exception", "ownership_handoff"].includes(approvalType)) {
    return { error: "Invalid approval type" };
  }
  if (requiredApproverId && !isUuid(requiredApproverId))
    return { error: "Invalid approver ID" };
  const minAnnualValue = minAnnualValueRaw ? Number(minAnnualValueRaw) : null;
  if (minAnnualValueRaw && (!Number.isFinite(minAnnualValue) || (minAnnualValue ?? 0) < 0))
    return { error: "Invalid minimum annual value" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  if (requiredApproverId) {
    const approverRole = await getOrgMemberRole(admin, requiredApproverId, membership.organization_id);
    if (!approverRole) return { error: "Required approver is not a member of this organization" };
  }
  const { error } = await admin.from("approval_policies").insert({
    organization_id: membership.organization_id,
    approval_type: approvalType,
    min_annual_value: minAnnualValue,
    contract_type: contractType,
    required_approver_id: requiredApproverId,
    required: true,
    active: true,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function toggleApprovalPolicyForm(policyId: string, active: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUuid(policyId)) return { error: "Invalid request" };
  const { data: row } = await admin
    .from("approval_policies")
    .select("id, organization_id")
    .eq("id", policyId)
    .maybeSingle();
  if (!row) return { error: "Policy not found" };
  const role = await getOrgMemberRole(admin, user.id, row.organization_id);
  if (role !== "admin") return { error: "Access denied" };
  const { error } = await admin.from("approval_policies").update({ active }).eq("id", policyId);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function setIntegrationTokenForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const provider = String(formData.get("provider") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim() || null;
  const refreshToken = String(formData.get("refreshToken") ?? "").trim() || null;
  const connectedAccount = String(formData.get("connectedAccount") ?? "").trim() || null;
  const expiresAt = String(formData.get("tokenExpiresAt") ?? "").trim() || null;
  if (!["google_calendar", "outlook_calendar", "slack", "email", "crm"].includes(provider))
    return { error: "Invalid provider" };
  if (expiresAt && Number.isNaN(Date.parse(expiresAt)))
    return { error: "Invalid token expiry date" };
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  let encryptedAccessToken: string | null = null;
  let encryptedRefreshToken: string | null = null;
  try {
    encryptedAccessToken = encryptIntegrationToken(accessToken);
    encryptedRefreshToken = encryptIntegrationToken(refreshToken);
  } catch {
    return { error: "Integration token encryption failed" };
  }
  const { error } = await admin.from("integration_connections").upsert(
    {
      organization_id: membership.organization_id,
      provider,
      status: accessToken ? "connected" : "not_connected",
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: expiresAt,
      connected_account: connectedAccount,
      oauth_connected_at: accessToken ? new Date().toISOString() : null,
      created_by: user.id,
    },
    { onConflict: "organization_id,provider", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

function normalizeApiKeyScopes(input: string[] | null | undefined): string[] {
  const allowed = new Set(["events:read"]);
  const normalized = (input ?? [])
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0 && allowed.has(scope));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["events:read"];
}

export async function createIntegrationApiKey(input: {
  organizationId: string;
  label: string;
  scopes?: string[] | null;
  expiresAt?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const organizationId = input.organizationId.trim();
  const label = input.label.trim();
  if (!isUuid(organizationId) || !label) return { error: "Invalid request" };
  const scopes = normalizeApiKeyScopes(input.scopes);
  const expiresAt = input.expiresAt?.trim() ? input.expiresAt.trim() : null;
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
    return { error: "Invalid expiry date" };
  }
  const role = await getOrgMemberRole(admin, user.id, organizationId);
  if (role !== "admin") return { error: "Access denied" };
  const token = `cop_${randomBytes(24).toString("hex")}`;
  const keyPrefix = token.slice(0, 12);
  const keyHash = createHash("sha256").update(token).digest("hex");
  const { error } = await admin.from("integration_api_keys").insert({
    organization_id: organizationId,
    label,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes,
    expires_at: expiresAt,
    active: true,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const, token, keyPrefix };
}

export async function revokeIntegrationApiKeyForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const keyId = String(formData.get("keyId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!isUuid(keyId)) return { error: "Invalid key ID" };
  const { data: row } = await admin
    .from("integration_api_keys")
    .select("id, organization_id, revoked_at")
    .eq("id", keyId)
    .maybeSingle();
  if (!row || row.revoked_at) return { error: "Key not found or already revoked" };
  const role = await getOrgMemberRole(admin, user.id, row.organization_id);
  if (role !== "admin") return { error: "Access denied" };
  const { error } = await admin
    .from("integration_api_keys")
    .update({
      active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq("id", keyId);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}

export async function updateIntegrationApiKeyPolicyForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const keyId = String(formData.get("keyId") ?? "").trim();
  if (!isUuid(keyId)) return { error: "Invalid key ID" };
  const scopesRaw = String(formData.get("scopes") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "1";
  const scopes = normalizeApiKeyScopes(
    scopesRaw
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean)
  );
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime()))
    return { error: "Invalid expiry date" };
  const { data: row } = await admin
    .from("integration_api_keys")
    .select("id, organization_id, revoked_at")
    .eq("id", keyId)
    .maybeSingle();
  if (!row || row.revoked_at) return { error: "Key not found or already revoked" };
  const role = await getOrgMemberRole(admin, user.id, row.organization_id);
  if (role !== "admin") return { error: "Access denied" };
  const { error } = await admin
    .from("integration_api_keys")
    .update({
      scopes,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      active,
    })
    .eq("id", keyId);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true };
}
