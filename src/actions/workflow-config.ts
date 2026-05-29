"use server";

import {
  createAdminClient,
  createClient,
  getOrEnsureDeterministicMembership,
} from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { encryptIntegrationToken } from "@/lib/security/token-crypto";
import {
  hasUnsafeJsonKey,
  isJsonShapeWithinLimits,
  isUuid,
  parseFixedEnumParam,
  parseFutureIsoTimestamp,
  parsePositiveIntParam,
  validateBoundedString,
} from "@/lib/security/validation";
import { sanitizeRolePolicyJson } from "@/lib/settings/sanitize-role-policy-json";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";
import { buildOperationalIntegrationDisconnectPatch } from "@/lib/integrations/operational-sync";

const WORKFLOW_INTEGRATION_PROVIDERS = ["google_calendar", "outlook_calendar", "slack", "email", "crm"] as const;
const WORKFLOW_INTEGRATION_STATUSES = ["not_connected", "connected", "error"] as const;
const WORKFLOW_TASK_PRIORITIES = ["low", "medium", "high"] as const;
const WORKFLOW_POLICY_PACKS = ["balanced", "compliance", "revenue"] as const;
const WORKFLOW_APPROVAL_TYPES = [
  "renewal_decision",
  "notice_action",
  "commercial_exception",
  "ownership_handoff",
] as const;
const CORE_NOTIFICATION_TYPES = SETTINGS_NOTIFICATIONS_STRINGS.categories.map((category) => category.key);
function isCoreNotificationType(value: string): value is (typeof CORE_NOTIFICATION_TYPES)[number] {
  return (CORE_NOTIFICATION_TYPES as readonly string[]).includes(value);
}

const MAX_WORKFLOW_KEY_LEN = 120;
const MAX_WORKFLOW_LABEL_LEN = 240;
const MAX_WORKFLOW_CONTRACT_TYPE_LEN = 160;
const MAX_WORKFLOW_URL_LEN = 2048;
const MAX_WORKFLOW_SECRET_LEN = 1024;
const MAX_WORKFLOW_EVENTS_CSV_LEN = 1000;
const MAX_WORKFLOW_EVENT_COUNT = 25;
const MAX_WORKFLOW_DEFAULT_VALUE_LEN = 4000;
const MAX_WORKFLOW_TASK_DETAILS_LEN = 4000;
const MAX_WORKFLOW_JSON_LEN = 12000;
const MAX_WORKFLOW_ERROR_TEXT_LEN = 1000;
const MAX_WORKFLOW_CSV_LEN = 1000;
const MAX_WORKFLOW_CSV_ITEMS = 50;
const MAX_WORKFLOW_TOKEN_LEN = 4096;
const MAX_WORKFLOW_CONNECTED_ACCOUNT_LEN = 254;
const MAX_WORKFLOW_API_KEY_LABEL_LEN = 120;
const MAX_WORKFLOW_API_KEY_REASON_LEN = 1000;
const MAX_WORKFLOW_OFFSET_DAYS = 3650;
const MAX_WORKFLOW_EXPIRY_DAYS = 3650;
const SAFE_WORKFLOW_TOKEN_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;

type WorkflowStringResult =
  | { ok: true; value: string }
  | { ok: false; error: "invalid_string" | "string_too_long" | "unsafe_characters" };

function readWorkflowString(
  formData: FormData,
  key: string,
  options: { maxLength: number; allowEmpty?: boolean; allowTextWhitespaceControls?: boolean }
): WorkflowStringResult {
  return validateBoundedString(formData.get(key) ?? "", options);
}

function readOptionalWorkflowString(
  formData: FormData,
  key: string,
  options: { maxLength: number; allowTextWhitespaceControls?: boolean }
): WorkflowStringResult {
  return validateBoundedString(formData.get(key) ?? "", {
    ...options,
    allowEmpty: true,
  });
}

function textInputError(field: string, result: Extract<WorkflowStringResult, { ok: false }>): string {
  if (result.error === "string_too_long") return `${field} is too long`;
  if (result.error === "unsafe_characters") return `${field} contains unsupported characters`;
  return `${field} is invalid`;
}

function readWorkflowEnum<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[]
): T | null {
  const raw = formData.get(key);
  if (raw != null && typeof raw !== "string") return null;
  const value = (raw ?? "").trim();
  if (!value) return null;
  const parsed = parseFixedEnumParam(value, allowed, allowed[0]);
  return parsed === value ? parsed : null;
}

function parseWorkflowInt(
  formData: FormData,
  key: string,
  options: { defaultValue: number; min?: number; max: number }
): number {
  return parsePositiveIntParam(String(formData.get(key) ?? "").trim(), options);
}

function parseWorkflowStrictInt(
  formData: FormData,
  key: string,
  options: { min?: number; max: number }
): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  return parsePositiveIntParam(raw, { defaultValue: options.min ?? 0, min: options.min ?? 0, max: options.max });
}

function parseWorkflowTokenCsv(
  value: string,
  options: { maxItems?: number } = {}
): { ok: true; values: string[] } | { ok: false } {
  if (!value) return { ok: true, values: [] };
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length > (options.maxItems ?? MAX_WORKFLOW_CSV_ITEMS)) return { ok: false };
  if (!values.every((entry) => SAFE_WORKFLOW_TOKEN_RE.test(entry))) return { ok: false };
  return { ok: true, values: Array.from(new Set(values)) };
}

function parseWorkflowHttpsUrl(value: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!value) return { ok: false, error: "URL and secret are required" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Webhook URL must be a valid HTTPS URL" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Webhook URL must use HTTPS" };
  if (url.username || url.password) return { ok: false, error: "Webhook URL must not include credentials" };
  if (url.hash) url.hash = "";
  return { ok: true, value: url.toString() };
}

function parseWorkflowJsonObject(
  value: string,
  options: { maxDepth?: number; maxArrayLength?: number; maxKeys?: number; maxStringLength?: number } = {}
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!value) return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false };
  if (hasUnsafeJsonKey(parsed)) return { ok: false };
  if (
    !isJsonShapeWithinLimits(parsed, {
      allowJsonWhitespaceControls: true,
      maxDepth: options.maxDepth ?? 6,
      maxArrayLength: options.maxArrayLength ?? 50,
      maxKeys: options.maxKeys ?? 100,
      maxStringLength: options.maxStringLength ?? 2000,
    })
  ) {
    return { ok: false };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

function normalizeOptionalExpiryIso(value: string | null): { ok: true; value: string | null } | { ok: false } {
  if (!value) return { ok: true, value: null };
  const raw = value.trim();
  const normalizedInput = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00Z` : raw;
  const parsed = parseFutureIsoTimestamp(normalizedInput, { maxFutureDays: MAX_WORKFLOW_EXPIRY_DAYS });
  if (!parsed.ok) return { ok: false };
  return { ok: true, value: parsed.value ?? null };
}

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
  const nameValidation = readWorkflowString(formData, "taskKey", { maxLength: MAX_WORKFLOW_KEY_LEN });
  const labelValidation = readWorkflowString(formData, "label", { maxLength: MAX_WORKFLOW_LABEL_LEN });
  const contractTypeValidation = readOptionalWorkflowString(formData, "contractType", {
    maxLength: MAX_WORKFLOW_CONTRACT_TYPE_LEN,
  });
  const offsetDays = parseWorkflowStrictInt(formData, "offsetDays", { min: 0, max: MAX_WORKFLOW_OFFSET_DAYS });
  if (!nameValidation.ok) return { error: textInputError("Playbook task key", nameValidation) };
  if (!labelValidation.ok) return { error: textInputError("Playbook label", labelValidation) };
  if (!contractTypeValidation.ok) return { error: textInputError("Contract type", contractTypeValidation) };
  if (offsetDays == null) return { error: "Invalid playbook template input" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = nameValidation.value;
  const label = labelValidation.value;
  const contractType = contractTypeValidation.value || null;

  const { data: membership } = await getMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer"))
    return { error: "Access denied" };

  const { error } = await admin.from("renewal_playbook_templates").upsert(
    {
      organization_id: membership.organization_id,
      contract_type: contractType,
      task_key: name,
      label,
      offset_days: offsetDays,
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
      details: { contract_type: contractType, task_key: name, offset_days: offsetDays },
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
  const urlValidation = readWorkflowString(formData, "url", { maxLength: MAX_WORKFLOW_URL_LEN });
  const secretValidation = readWorkflowString(formData, "secret", { maxLength: MAX_WORKFLOW_SECRET_LEN });
  const eventsValidation = readOptionalWorkflowString(formData, "events", { maxLength: MAX_WORKFLOW_EVENTS_CSV_LEN });
  if (!urlValidation.ok) return { error: textInputError("Webhook URL", urlValidation) };
  if (!secretValidation.ok) return { error: textInputError("Webhook secret", secretValidation) };
  if (!eventsValidation.ok) return { error: textInputError("Webhook events", eventsValidation) };
  const webhookUrl = parseWorkflowHttpsUrl(urlValidation.value);
  if (!webhookUrl.ok) return { error: webhookUrl.error };
  const parsedEvents = parseWorkflowTokenCsv(eventsValidation.value, { maxItems: MAX_WORKFLOW_EVENT_COUNT });
  if (!parsedEvents.ok) return { error: "Invalid webhook events" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };

  let encryptedSecret: string;
  try {
    encryptedSecret = encryptIntegrationToken(secretValidation.value) ?? "";
  } catch {
    return { error: "Webhook secret encryption failed" };
  }
  if (!encryptedSecret) return { error: "Webhook secret encryption failed" };

  const { error } = await admin.from("webhook_subscriptions").insert({
    organization_id: membership.organization_id,
    url: webhookUrl.value,
    secret: encryptedSecret,
    events: parsedEvents.values.length ? parsedEvents.values : ["contract.updated", "reminder.due"],
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
  const fieldNameValidation = readWorkflowString(formData, "fieldName", { maxLength: MAX_WORKFLOW_KEY_LEN });
  const contractTypeValidation = readOptionalWorkflowString(formData, "contractType", {
    maxLength: MAX_WORKFLOW_CONTRACT_TYPE_LEN,
  });
  const defaultValueValidation = readOptionalWorkflowString(formData, "defaultValue", {
    maxLength: MAX_WORKFLOW_DEFAULT_VALUE_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!fieldNameValidation.ok) return { error: textInputError("Field name", fieldNameValidation) };
  if (!contractTypeValidation.ok) return { error: textInputError("Contract type", contractTypeValidation) };
  if (!defaultValueValidation.ok) return { error: textInputError("Default value", defaultValueValidation) };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const fieldName = fieldNameValidation.value;
  const contractType = contractTypeValidation.value || null;
  const defaultValue = defaultValueValidation.value || null;
  const required = String(formData.get("required") ?? "") === "1";
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
  const contractTypeValidation = readOptionalWorkflowString(formData, "contractType", {
    maxLength: MAX_WORKFLOW_CONTRACT_TYPE_LEN,
  });
  const fieldNameValidation = readWorkflowString(formData, "fieldName", { maxLength: MAX_WORKFLOW_KEY_LEN });
  const reminderTypeValidation = readWorkflowString(formData, "reminderType", { maxLength: MAX_WORKFLOW_KEY_LEN });
  const offsetDays = parseWorkflowStrictInt(formData, "offsetDays", { min: 0, max: MAX_WORKFLOW_OFFSET_DAYS });
  if (!contractTypeValidation.ok) return { error: textInputError("Contract type", contractTypeValidation) };
  if (!fieldNameValidation.ok) return { error: textInputError("Field name", fieldNameValidation) };
  if (!reminderTypeValidation.ok) return { error: textInputError("Reminder type", reminderTypeValidation) };
  if (!SAFE_WORKFLOW_TOKEN_RE.test(reminderTypeValidation.value)) return { error: "Invalid reminder template input" };
  if (offsetDays == null) return { error: "Invalid reminder template input" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const contractType = contractTypeValidation.value || null;
  const fieldName = fieldNameValidation.value;
  const reminderType = reminderTypeValidation.value;
  const { data: membership } = await getMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer"))
    return { error: "Access denied" };
  const { error } = await admin.from("reminder_templates").upsert(
    {
      organization_id: membership.organization_id,
      contract_type: contractType,
      field_name: fieldName,
      offset_days: offsetDays,
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
    .eq("offset_days", offsetDays)
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
  const contractTypeValidation = readOptionalWorkflowString(formData, "contractType", {
    maxLength: MAX_WORKFLOW_CONTRACT_TYPE_LEN,
  });
  const teamKeyValidation = readOptionalWorkflowString(formData, "teamKey", { maxLength: MAX_WORKFLOW_KEY_LEN });
  const titleValidation = readWorkflowString(formData, "title", { maxLength: MAX_WORKFLOW_LABEL_LEN });
  const detailsValidation = readOptionalWorkflowString(formData, "details", {
    maxLength: MAX_WORKFLOW_TASK_DETAILS_LEN,
    allowTextWhitespaceControls: true,
  });
  const dueOffsetDays = parseWorkflowStrictInt(formData, "dueOffsetDays", { min: 0, max: MAX_WORKFLOW_OFFSET_DAYS });
  const priority = readWorkflowEnum(formData, "priority", WORKFLOW_TASK_PRIORITIES);
  if (!contractTypeValidation.ok) return { error: textInputError("Contract type", contractTypeValidation) };
  if (!teamKeyValidation.ok) return { error: textInputError("Team key", teamKeyValidation) };
  if (!titleValidation.ok) return { error: textInputError("Task title", titleValidation) };
  if (!detailsValidation.ok) return { error: textInputError("Task details", detailsValidation) };
  if (dueOffsetDays == null || !priority) return { error: "Invalid task template input" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const contractType = contractTypeValidation.value || null;
  const teamKey = teamKeyValidation.value || null;
  const title = titleValidation.value;
  const details = detailsValidation.value || null;
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
      due_offset_days: dueOffsetDays,
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
  const provider = readWorkflowEnum(formData, "provider", WORKFLOW_INTEGRATION_PROVIDERS);
  const status = readWorkflowEnum(formData, "status", WORKFLOW_INTEGRATION_STATUSES);
  const configValidation = readOptionalWorkflowString(formData, "configJson", {
    maxLength: MAX_WORKFLOW_JSON_LEN,
    allowTextWhitespaceControls: true,
  });
  const lastErrorValidation = readOptionalWorkflowString(formData, "lastError", {
    maxLength: MAX_WORKFLOW_ERROR_TEXT_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!provider) return { error: "Invalid provider" };
  if (!status) return { error: "Invalid status" };
  if (!configValidation.ok) return { error: textInputError("Integration config", configValidation) };
  if (!lastErrorValidation.ok) return { error: textInputError("Integration last error", lastErrorValidation) };
  const parsedConfig = parseWorkflowJsonObject(configValidation.value);
  if (!parsedConfig.ok) return { error: "Invalid configJson payload" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const lastError = lastErrorValidation.value || null;
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  const { error } = await admin.from("integration_connections").upsert(
    {
      organization_id: membership.organization_id,
      provider,
      status,
      config_json: parsedConfig.value,
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
  const weeklyIntakeLookbackDays = parseWorkflowInt(formData, "weeklyIntakeLookbackDays", {
    defaultValue: 7,
    min: 1,
    max: 30,
  });
  const renewalHorizonDays = parseWorkflowInt(formData, "renewalHorizonDays", {
    defaultValue: 90,
    min: 30,
    max: 365,
  });
  const staleContractDays = parseWorkflowInt(formData, "staleContractDays", {
    defaultValue: 120,
    min: 30,
    max: 365,
  });
  const staleOwnershipDays = parseWorkflowInt(formData, "staleOwnershipDays", {
    defaultValue: 90,
    min: 14,
    max: 365,
  });
  const emailQuietStart = parseWorkflowInt(formData, "emailQuietStartUtc", { defaultValue: 0, min: 0, max: 23 });
  const emailQuietEnd = parseWorkflowInt(formData, "emailQuietEndUtc", { defaultValue: 0, min: 0, max: 23 });
  const slackQuietStart = parseWorkflowInt(formData, "slackQuietStartUtc", { defaultValue: 0, min: 0, max: 23 });
  const slackQuietEnd = parseWorkflowInt(formData, "slackQuietEndUtc", { defaultValue: 0, min: 0, max: 23 });
  const emailBlockedTypesValidation = readOptionalWorkflowString(formData, "emailBlockedTypes", {
    maxLength: MAX_WORKFLOW_CSV_LEN,
  });
  const slackBlockedTypesValidation = readOptionalWorkflowString(formData, "slackBlockedTypes", {
    maxLength: MAX_WORKFLOW_CSV_LEN,
  });
  const rolePolicyValidation = readOptionalWorkflowString(formData, "rolePolicyJson", {
    maxLength: MAX_WORKFLOW_JSON_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!emailBlockedTypesValidation.ok)
    return { error: textInputError("Email blocked notification types", emailBlockedTypesValidation) };
  if (!slackBlockedTypesValidation.ok)
    return { error: textInputError("Slack blocked notification types", slackBlockedTypesValidation) };
  if (!rolePolicyValidation.ok) return { error: textInputError("Role policy JSON", rolePolicyValidation) };
  const selectedNotificationCategories = new Set(
    formData
      .getAll("notificationCategories")
      .filter((value): value is (typeof CORE_NOTIFICATION_TYPES)[number] => typeof value === "string" && isCoreNotificationType(value))
  );
  const usesCategoryForm = formData.get("notificationCategoryForm") === "1";
  const emailBlockedTypes = usesCategoryForm
    ? {
        ok: true as const,
        values: CORE_NOTIFICATION_TYPES.filter((type) => !selectedNotificationCategories.has(type)),
      }
    : parseWorkflowTokenCsv(emailBlockedTypesValidation.value, {
        maxItems: MAX_WORKFLOW_CSV_ITEMS,
      });
  const slackBlockedTypes = parseWorkflowTokenCsv(slackBlockedTypesValidation.value, {
    maxItems: MAX_WORKFLOW_CSV_ITEMS,
  });
  if (!emailBlockedTypes.ok || !slackBlockedTypes.ok) return { error: "Invalid notification type filters" };
  const parsedRolePolicyJson = parseWorkflowJsonObject(rolePolicyValidation.value, {
    maxDepth: 5,
    maxArrayLength: 10,
    maxKeys: 100,
    maxStringLength: 200,
  });
  if (!parsedRolePolicyJson.ok) return { error: "Invalid rolePolicyJson payload" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const emailEnabled = formData.has("emailEnabled");
  const slackEnabled = formData.has("slackEnabled");
  const dashboardTrackingEnabled = formData.has("dashboardTrackingEnabled");
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  const rolePolicyJson = sanitizeRolePolicyJson(parsedRolePolicyJson.value);
  const { error } = await admin.from("organization_workflow_settings").upsert(
    {
      organization_id: membership.organization_id,
      weekly_intake_lookback_days: weeklyIntakeLookbackDays,
      renewal_horizon_days: renewalHorizonDays,
      stale_contract_days: staleContractDays,
      stale_ownership_days: staleOwnershipDays,
      notification_policy_json: {
        email: {
          enabled: emailEnabled,
          quiet_hours_start_utc: emailQuietStart,
          quiet_hours_end_utc: emailQuietEnd,
          blocked_types: emailBlockedTypes.values,
        },
        slack: {
          enabled: slackEnabled,
          quiet_hours_start_utc: slackQuietStart,
          quiet_hours_end_utc: slackQuietEnd,
          blocked_types: slackBlockedTypes.values,
        },
      },
      role_policy_json: rolePolicyJson,
      dashboard_tracking_enabled: dashboardTrackingEnabled,
      created_by: user.id,
    },
    { onConflict: "organization_id", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/settings/operations");
  return { success: true };
}

export async function applyPolicyPackForm(formData: FormData) {
  const policyPack = readWorkflowEnum(formData, "policyPack", WORKFLOW_POLICY_PACKS);
  if (!policyPack) return { error: "Invalid policy pack" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
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
  const approvalType = readWorkflowEnum(formData, "approvalType", WORKFLOW_APPROVAL_TYPES);
  const contractTypeValidation = readOptionalWorkflowString(formData, "contractType", {
    maxLength: MAX_WORKFLOW_CONTRACT_TYPE_LEN,
  });
  const requiredApproverId = String(formData.get("requiredApproverId") ?? "").trim() || null;
  const minAnnualValueRaw = String(formData.get("minAnnualValue") ?? "").trim();
  if (!approvalType) return { error: "Invalid approval type" };
  if (!contractTypeValidation.ok) return { error: textInputError("Contract type", contractTypeValidation) };
  if (requiredApproverId && !isUuid(requiredApproverId)) return { error: "Invalid approver ID" };
  const minAnnualValue = minAnnualValueRaw ? Number(minAnnualValueRaw) : null;
  if (minAnnualValueRaw && (!Number.isFinite(minAnnualValue) || (minAnnualValue ?? 0) < 0))
    return { error: "Invalid minimum annual value" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const contractType = contractTypeValidation.value || null;
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
  const provider = readWorkflowEnum(formData, "provider", WORKFLOW_INTEGRATION_PROVIDERS);
  const accessTokenValidation = readOptionalWorkflowString(formData, "accessToken", {
    maxLength: MAX_WORKFLOW_TOKEN_LEN,
  });
  const refreshTokenValidation = readOptionalWorkflowString(formData, "refreshToken", {
    maxLength: MAX_WORKFLOW_TOKEN_LEN,
  });
  const connectedAccountValidation = readOptionalWorkflowString(formData, "connectedAccount", {
    maxLength: MAX_WORKFLOW_CONNECTED_ACCOUNT_LEN,
  });
  const expiresAtValidation = readOptionalWorkflowString(formData, "tokenExpiresAt", { maxLength: 80 });
  if (!provider) return { error: "Invalid provider" };
  if (!accessTokenValidation.ok) return { error: textInputError("Access token", accessTokenValidation) };
  if (!refreshTokenValidation.ok) return { error: textInputError("Refresh token", refreshTokenValidation) };
  if (!connectedAccountValidation.ok) return { error: textInputError("Connected account", connectedAccountValidation) };
  if (!expiresAtValidation.ok) return { error: textInputError("Token expiry date", expiresAtValidation) };
  const expiresAt = normalizeOptionalExpiryIso(expiresAtValidation.value);
  if (!expiresAt.ok) return { error: "Invalid token expiry date" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    return {
      error: "Confirm your password under Settings → Security before updating integration tokens.",
      needStepUp: true as const,
    };
  }
  const accessToken = accessTokenValidation.value || null;
  const refreshToken = refreshTokenValidation.value || null;
  const connectedAccount = connectedAccountValidation.value || null;
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
      token_expires_at: expiresAt.value,
      connected_account: connectedAccount,
      oauth_connected_at: accessToken ? new Date().toISOString() : null,
      created_by: user.id,
    },
    { onConflict: "organization_id,provider", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  void recordSecurityAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    action: "security.integration_token_updated",
    targetType: "integration_connection",
    targetId: provider,
    outcome: "success",
    safeMetadata: {
      provider,
      accessTokenSet: Boolean(accessToken),
      refreshTokenSet: Boolean(refreshToken),
      connectedAccountSet: Boolean(connectedAccount),
      expiresAtSet: Boolean(expiresAt.value),
    },
  });
  return { success: true };
}

export async function disconnectIntegrationConnectionForm(formData: FormData) {
  const provider = readWorkflowEnum(formData, "provider", WORKFLOW_INTEGRATION_PROVIDERS);
  const reasonValidation = readOptionalWorkflowString(formData, "reason", {
    maxLength: MAX_WORKFLOW_API_KEY_REASON_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!provider) return { error: "Invalid provider" };
  if (!reasonValidation.ok) return { error: textInputError("Disconnect reason", reasonValidation) };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    return {
      error: "Confirm your password under Settings > Security before disconnecting integrations.",
      needStepUp: true as const,
    };
  }
  const { data: membership } = await getMembership(admin, user);
  if (!membership || membership.role !== "admin") return { error: "Access denied" };
  const { data: row, error: loadError } = await admin
    .from("integration_connections")
    .select("id, organization_id, provider, status")
    .eq("organization_id", membership.organization_id)
    .eq("provider", provider)
    .maybeSingle();
  if (loadError) return { error: mapDataSourceError(loadError.message) };
  if (!row) return { error: "Integration connection not found" };

  const nowIso = new Date().toISOString();
  const disconnectPatch = buildOperationalIntegrationDisconnectPatch({
    nowIso,
    reason: reasonValidation.value,
  });
  const { error } = await admin
    .from("integration_connections")
    .update(disconnectPatch)
    .eq("id", row.id)
    .eq("organization_id", membership.organization_id);
  if (error) return { error: mapDataSourceError(error.message) };
  void recordSecurityAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    action: "security.integration_disconnected",
    targetType: "integration_connection",
    targetId: row.id,
    outcome: "success",
    safeMetadata: {
      provider,
      previousStatus: row.status,
      reason: reasonValidation.value || "manual_disconnect",
      localTokenDeletion: true,
      webhookCleanup: true,
      staleScheduledJobsBlocked: true,
      historicalRecordPreserved: true,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/operations");
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
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    return {
      error: "Confirm your password under Settings → Security before creating API keys.",
      needStepUp: true as const,
    };
  }
  const organizationId = input.organizationId.trim();
  const labelValidation = validateBoundedString(input.label, { maxLength: MAX_WORKFLOW_API_KEY_LABEL_LEN });
  if (!isUuid(organizationId) || !labelValidation.ok) return { error: "Invalid request" };
  const label = labelValidation.value;
  const scopes = normalizeApiKeyScopes(input.scopes);
  const expiresAt = normalizeOptionalExpiryIso(input.expiresAt?.trim() ? input.expiresAt.trim() : null);
  if (!expiresAt.ok) {
    return { error: "Invalid expiry date" };
  }
  const role = await getOrgMemberRole(admin, user.id, organizationId);
  if (role !== "admin") return { error: "Access denied" };
  const token = `cop_${randomBytes(24).toString("hex")}`;
  const keyPrefix = token.slice(0, 12);
  const keyHash = createHash("sha256").update(token).digest("hex");
  const { data: inserted, error } = await admin
    .from("integration_api_keys")
    .insert({
      organization_id: organizationId,
      label,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes,
      expires_at: expiresAt.value,
      active: true,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return { error: mapDataSourceError(error.message) };
  if (inserted?.id) {
    void recordSecurityAuditEvent(admin, {
      organizationId,
      actorUserId: user.id,
      action: "security.integration_api_key_created",
      targetType: "integration_api_key",
      targetId: String(inserted.id),
      outcome: "success",
      safeMetadata: { label, keyPrefix },
    });
  }
  return { success: true as const, token, keyPrefix };
}

/** Form wrapper for Settings → Workflow configuration; resolves org server-side (no client org id). */
export async function createIntegrationApiKeyFromOperationsForm(formData: FormData) {
  const labelValidation = readWorkflowString(formData, "label", { maxLength: MAX_WORKFLOW_API_KEY_LABEL_LEN });
  const scopesValidation = readOptionalWorkflowString(formData, "scopes", { maxLength: MAX_WORKFLOW_CSV_LEN });
  const expiresAtValidation = readOptionalWorkflowString(formData, "expiresAt", { maxLength: 80 });
  if (!labelValidation.ok || !scopesValidation.ok || !expiresAtValidation.ok) return;
  const scopes = parseWorkflowTokenCsv(scopesValidation.value, { maxItems: 10 });
  const expiresAt = normalizeOptionalExpiryIso(expiresAtValidation.value);
  if (!scopes.ok || !expiresAt.ok) return;

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) return;

  const res = await createIntegrationApiKey({
    organizationId: membership.organization_id,
    label: labelValidation.value,
    scopes: scopes.values,
    expiresAt: expiresAt.value,
  });

  if (res && "error" in res && res.error) {
    console.error(
      "[workflow-config] createIntegrationApiKeyFromOperationsForm",
      formatUnknownForServerLog(res.error)
    );
    return;
  }
  if (res && "success" in res && res.success) {
    const cookieStore = await cookies();
    cookieStore.set("oblixa_new_api_key_token", res.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/settings/operations",
    });
  }
}

export async function revokeIntegrationApiKeyForm(formData: FormData) {
  const keyId = String(formData.get("keyId") ?? "").trim();
  const reasonValidation = readOptionalWorkflowString(formData, "reason", {
    maxLength: MAX_WORKFLOW_API_KEY_REASON_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!isUuid(keyId)) return { error: "Invalid key ID" };
  if (!reasonValidation.ok) return { error: textInputError("Revocation reason", reasonValidation) };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    return {
      error: "Confirm your password under Settings → Security before revoking API keys.",
      needStepUp: true as const,
    };
  }
  const reason = reasonValidation.value || null;
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
  void recordSecurityAuditEvent(admin, {
    organizationId: row.organization_id,
    actorUserId: user.id,
    action: "security.integration_api_key_revoked",
    targetType: "integration_api_key",
    targetId: keyId,
    outcome: "success",
    safeMetadata: reason ? { reason } : {},
  });
  return { success: true };
}

export async function updateIntegrationApiKeyPolicyForm(formData: FormData) {
  const keyId = String(formData.get("keyId") ?? "").trim();
  const scopesValidation = readOptionalWorkflowString(formData, "scopes", { maxLength: MAX_WORKFLOW_CSV_LEN });
  const expiresAtValidation = readOptionalWorkflowString(formData, "expiresAt", { maxLength: 80 });
  if (!isUuid(keyId)) return { error: "Invalid key ID" };
  if (!scopesValidation.ok) return { error: textInputError("API key scopes", scopesValidation) };
  if (!expiresAtValidation.ok) return { error: textInputError("API key expiry date", expiresAtValidation) };
  const parsedScopes = parseWorkflowTokenCsv(scopesValidation.value, { maxItems: 10 });
  if (!parsedScopes.ok) return { error: "Invalid API key scopes" };
  const expiresAt = normalizeOptionalExpiryIso(expiresAtValidation.value);
  if (!expiresAt.ok) return { error: "Invalid expiry date" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    return {
      error: "Confirm your password under Settings → Security before updating API key policy.",
      needStepUp: true as const,
    };
  }
  const active = String(formData.get("active") ?? "") === "1";
  const scopes = normalizeApiKeyScopes(parsedScopes.values);
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
      expires_at: expiresAt.value,
      active,
    })
    .eq("id", keyId);
  if (error) return { error: mapDataSourceError(error.message) };
  void recordSecurityAuditEvent(admin, {
    organizationId: row.organization_id,
    actorUserId: user.id,
    action: "security.integration_api_key_policy_updated",
    targetType: "integration_api_key",
    targetId: keyId,
    outcome: "success",
    safeMetadata: {
      scopes,
      expiresAt: expiresAt.value,
      active,
    },
  });
  return { success: true };
}
