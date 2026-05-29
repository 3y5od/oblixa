import { createHash } from "node:crypto";
import {
  isSensitiveLogKey,
  redactSensitiveLogString,
  REDACTION_REPLACEMENT,
} from "@/lib/observability/log-redaction";

export const OPERATIONAL_SPAN_KINDS = [
  "api_route",
  "cron_route",
  "webhook",
  "provider_call",
  "background_job",
] as const;

export type OperationalSpanKind = (typeof OPERATIONAL_SPAN_KINDS)[number];
export type OperationalAttributeValue = string | number | boolean | readonly (string | number | boolean)[];

export type OperationalSpanInput = {
  kind: OperationalSpanKind;
  operation: string;
  routeId?: string | null;
  requestId?: string | null;
  orgId?: string | null;
  userId?: string | null;
  jobId?: string | null;
  provider?: string | null;
  status?: string | number | null;
  durationMs?: number | null;
  errorClass?: string | null;
  attributes?: Record<string, unknown>;
};

export type OperationalSpanContract = {
  name: string;
  kind: OperationalSpanKind;
  attributes: Record<string, OperationalAttributeValue>;
};

const MAX_ATTRIBUTE_VALUE_LENGTH = 512;
const MAX_ATTRIBUTE_ARRAY_VALUES = 20;
const IDENTITY_ATTRIBUTE_RE =
  /^(?:org(?:anization)?|workspace|tenant|user|actor_user|member|account)[_-]?id$/iu;
const FORBIDDEN_ATTRIBUTE_KEY_RE =
  /(^|[_\-.])(raw|body|payload|contract|document|text|email|name|filename|file_name|token|secret|password|signature|cookie|authorization|private|signed|provider_response|provider_payload|provider_error)([_\-.]|$)/iu;

function safeOperationId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\[\[?\.{3}([^\]]+)\]\]?/gu, "$1")
    .replace(/\[([^\]]+)\]/gu, "$1")
    .replace(/[^a-z0-9]+/gu, ".")
    .replace(/^\.+|\.+$/gu, "")
    .slice(0, 120);
  return normalized || "operation";
}

function safeAttributeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 120);
}

function safeAttributeString(value: string): string {
  return redactSensitiveLogString(value, MAX_ATTRIBUTE_VALUE_LENGTH).slice(0, MAX_ATTRIBUTE_VALUE_LENGTH);
}

export function hashOperationalIdentifier(value: string | null | undefined): string | null {
  const input = String(value ?? "").trim();
  if (!input) return null;
  const digest = createHash("sha256").update(input).digest("hex").slice(0, 24);
  return `sha256:${digest}`;
}

function identityHashKey(key: string): string {
  const normalized = safeAttributeKey(key);
  if (normalized === "organization_id" || normalized === "organizationid" || normalized === "org_id") {
    return "org_id_hash";
  }
  if (normalized === "tenant_id" || normalized === "workspace_id") return `${normalized}_hash`;
  if (normalized === "actor_user_id" || normalized === "userid" || normalized === "user_id") {
    return "user_id_hash";
  }
  return `${normalized}_hash`;
}

function sanitizeScalarAttribute(key: string, value: unknown): OperationalAttributeValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    if (isSensitiveLogKey(key) || FORBIDDEN_ATTRIBUTE_KEY_RE.test(key)) return REDACTION_REPLACEMENT;
    return safeAttributeString(value);
  }
  return REDACTION_REPLACEMENT;
}

export function sanitizeOperationalSpanAttributes(input: Record<string, unknown> = {}): Record<string, OperationalAttributeValue> {
  const out: Record<string, OperationalAttributeValue> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = safeAttributeKey(rawKey);
    if (!key) continue;

    if (IDENTITY_ATTRIBUTE_RE.test(key) && typeof value === "string") {
      const hashed = hashOperationalIdentifier(value);
      if (hashed) out[identityHashKey(key)] = hashed;
      continue;
    }

    if (Array.isArray(value)) {
      const safeValues = value
        .slice(0, MAX_ATTRIBUTE_ARRAY_VALUES)
        .map((entry) => sanitizeScalarAttribute(key, entry))
        .filter((entry): entry is string | number | boolean => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean");
      if (safeValues.length > 0) out[key] = safeValues;
      continue;
    }

    const safeValue = sanitizeScalarAttribute(key, value);
    if (safeValue !== null) out[key] = safeValue;
  }
  return out;
}

function assignIfPresent(
  attributes: Record<string, OperationalAttributeValue>,
  key: string,
  value: string | number | null | undefined
) {
  if (value === null || value === undefined || value === "") return;
  attributes[key] = typeof value === "number" ? value : safeAttributeString(value);
}

export function buildOperationalSpanContract(input: OperationalSpanInput): OperationalSpanContract {
  const operationId = safeOperationId(input.operation);
  const attributes: Record<string, OperationalAttributeValue> = {
    "oblixa.span_kind": input.kind,
    operation_id: operationId,
  };

  assignIfPresent(attributes, "route_id", input.routeId);
  assignIfPresent(attributes, "request_id", input.requestId);
  assignIfPresent(attributes, "job_id", input.jobId);
  assignIfPresent(attributes, "provider", input.provider);
  assignIfPresent(attributes, "error_class", input.errorClass);

  const orgHash = hashOperationalIdentifier(input.orgId);
  const userHash = hashOperationalIdentifier(input.userId);
  if (orgHash) attributes.org_id_hash = orgHash;
  if (userHash) attributes.user_id_hash = userHash;

  if (typeof input.status === "number" && Number.isFinite(input.status)) {
    attributes.status_code = input.status;
    attributes.status_class = `${Math.floor(input.status / 100)}xx`;
  } else if (typeof input.status === "string" && input.status.trim()) {
    attributes.status = safeAttributeString(input.status);
  }

  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs)) {
    attributes.duration_ms = Math.max(0, Math.floor(input.durationMs));
  }

  for (const [key, value] of Object.entries(sanitizeOperationalSpanAttributes(input.attributes))) {
    if (!(key in attributes)) attributes[key] = value;
  }

  return {
    name: `oblixa.${input.kind}.${operationId}`,
    kind: input.kind,
    attributes,
  };
}

export async function withOperationalSpan<T>(
  input: OperationalSpanInput,
  operation: () => Promise<T> | T,
  emit: (span: OperationalSpanContract) => void = () => {}
): Promise<T> {
  const startedAtMs = Date.now();
  try {
    const result = await operation();
    emit(buildOperationalSpanContract({
      ...input,
      status: input.status ?? "ok",
      durationMs: input.durationMs ?? Date.now() - startedAtMs,
    }));
    return result;
  } catch (error) {
    emit(buildOperationalSpanContract({
      ...input,
      status: input.status ?? "error",
      durationMs: input.durationMs ?? Date.now() - startedAtMs,
      errorClass: input.errorClass ?? (error instanceof Error ? error.name : "unknown"),
    }));
    throw error;
  }
}
