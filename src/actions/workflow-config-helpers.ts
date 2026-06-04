import {
  hasUnsafeJsonKey,
  isJsonShapeWithinLimits,
  parseFixedEnumParam,
  parseFutureIsoTimestamp,
  parsePositiveIntParam,
  validateBoundedString,
} from "@/lib/security/validation";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";

export const WORKFLOW_INTEGRATION_PROVIDERS = ["google_calendar", "outlook_calendar", "slack", "email", "crm"] as const;
export const WORKFLOW_INTEGRATION_STATUSES = ["not_connected", "connected", "error"] as const;
export const WORKFLOW_TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const WORKFLOW_POLICY_PACKS = ["balanced", "compliance", "revenue"] as const;
export const WORKFLOW_APPROVAL_TYPES = [
  "renewal_decision",
  "notice_action",
  "commercial_exception",
  "ownership_handoff",
] as const;
export const CORE_NOTIFICATION_TYPES = SETTINGS_NOTIFICATIONS_STRINGS.categories.map((category) => category.key);

export function isCoreNotificationType(value: string): value is (typeof CORE_NOTIFICATION_TYPES)[number] {
  return (CORE_NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export const MAX_WORKFLOW_KEY_LEN = 120;
export const MAX_WORKFLOW_LABEL_LEN = 240;
export const MAX_WORKFLOW_CONTRACT_TYPE_LEN = 160;
export const MAX_WORKFLOW_URL_LEN = 2048;
export const MAX_WORKFLOW_SECRET_LEN = 1024;
export const MAX_WORKFLOW_EVENTS_CSV_LEN = 1000;
export const MAX_WORKFLOW_EVENT_COUNT = 25;
export const MAX_WORKFLOW_DEFAULT_VALUE_LEN = 4000;
export const MAX_WORKFLOW_TASK_DETAILS_LEN = 4000;
export const MAX_WORKFLOW_JSON_LEN = 12000;
export const MAX_WORKFLOW_ERROR_TEXT_LEN = 1000;
export const MAX_WORKFLOW_CSV_LEN = 1000;
export const MAX_WORKFLOW_CSV_ITEMS = 50;
export const MAX_WORKFLOW_TOKEN_LEN = 4096;
export const MAX_WORKFLOW_CONNECTED_ACCOUNT_LEN = 254;
export const MAX_WORKFLOW_API_KEY_LABEL_LEN = 120;
export const MAX_WORKFLOW_API_KEY_REASON_LEN = 1000;
export const MAX_WORKFLOW_OFFSET_DAYS = 3650;
const MAX_WORKFLOW_EXPIRY_DAYS = 3650;
export const SAFE_WORKFLOW_TOKEN_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;

export type WorkflowStringResult =
  | { ok: true; value: string }
  | { ok: false; error: "invalid_string" | "string_too_long" | "unsafe_characters" };

export function readWorkflowString(
  formData: FormData,
  key: string,
  options: { maxLength: number; allowEmpty?: boolean; allowTextWhitespaceControls?: boolean }
): WorkflowStringResult {
  return validateBoundedString(formData.get(key) ?? "", options);
}

export function readOptionalWorkflowString(
  formData: FormData,
  key: string,
  options: { maxLength: number; allowTextWhitespaceControls?: boolean }
): WorkflowStringResult {
  return validateBoundedString(formData.get(key) ?? "", {
    ...options,
    allowEmpty: true,
  });
}

export function textInputError(field: string, result: Extract<WorkflowStringResult, { ok: false }>): string {
  if (result.error === "string_too_long") return `${field} is too long`;
  if (result.error === "unsafe_characters") return `${field} contains unsupported characters`;
  return `${field} is invalid`;
}

export function readWorkflowEnum<T extends string>(
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

export function parseWorkflowInt(
  formData: FormData,
  key: string,
  options: { defaultValue: number; min?: number; max: number }
): number {
  return parsePositiveIntParam(String(formData.get(key) ?? "").trim(), options);
}

export function parseWorkflowStrictInt(
  formData: FormData,
  key: string,
  options: { min?: number; max: number }
): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  return parsePositiveIntParam(raw, { defaultValue: options.min ?? 0, min: options.min ?? 0, max: options.max });
}

export function parseWorkflowTokenCsv(
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

export function parseWorkflowHttpsUrl(value: string): { ok: true; value: string } | { ok: false; error: string } {
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

export function parseWorkflowJsonObject(
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

export function normalizeOptionalExpiryIso(value: string | null): { ok: true; value: string | null } | { ok: false } {
  if (!value) return { ok: true, value: null };
  const raw = value.trim();
  const normalizedInput = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00Z` : raw;
  const parsed = parseFutureIsoTimestamp(normalizedInput, { maxFutureDays: MAX_WORKFLOW_EXPIRY_DAYS });
  if (!parsed.ok) return { ok: false };
  return { ok: true, value: parsed.value ?? null };
}

export function normalizeApiKeyScopes(input: string[] | null | undefined): string[] {
  const allowed = new Set(["events:read"]);
  const normalized = (input ?? [])
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0 && allowed.has(scope));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["events:read"];
}
