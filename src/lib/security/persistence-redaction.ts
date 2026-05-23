import { createHash } from "node:crypto";
import { isSensitiveLogKey, redactSensitiveLogString, REDACTION_REPLACEMENT } from "@/lib/observability/log-redaction";
import { stripSensitiveUrlParams, urlContainsSensitiveParams } from "@/lib/security/sensitive-url";

const MAX_PERSISTED_STRING_LENGTH = 1200;
const MAX_ARRAY_ITEMS = 50;
const MAX_DEPTH = 10;

const HIGH_RISK_PERSISTENCE_KEY_RE =
  /(^|[_-])(authorization|cookie|set[_-]?cookie|password|passcode|secret|token|signature|api[_-]?key|webhook[_-]?secret|oauth[_-]?code|private[_-]?url|signed[_-]?url|raw[_-]?(?:document|contract|body|payload|message)?[_-]?text|document[_-]?text|contract[_-]?text|full[_-]?text|email[_-]?body|provider[_-]?(?:payload|response|error)|headers?)([_-]|$)/i;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function summarizeRedactedValue(value: unknown, reason: string): Record<string, unknown> {
  const serialized =
    typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value ?? "");
          }
        })();
  return {
    redacted: true,
    reason,
    original_type: Array.isArray(value) ? "array" : typeof value,
    value_sha256: sha256(serialized),
    value_length: serialized.length,
  };
}

function isUrlLike(value: string): boolean {
  return /^(?:https?:\/\/|\/[A-Za-z0-9/_\-?.=&%+#]+$)/i.test(value.trim());
}

export function redactPersistenceString(value: string, maxLength = MAX_PERSISTED_STRING_LENGTH): string {
  const withoutSensitiveQuery =
    isUrlLike(value) && urlContainsSensitiveParams(value) ? stripSensitiveUrlParams(value) : value;
  const redacted = redactSensitiveLogString(withoutSensitiveQuery, maxLength);
  if (isUrlLike(redacted) && urlContainsSensitiveParams(redacted)) {
    return stripSensitiveUrlParams(redacted);
  }
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 3)}...` : redacted;
}

export function isHighRiskPersistenceKey(key: string): boolean {
  return HIGH_RISK_PERSISTENCE_KEY_RE.test(key) || isSensitiveLogKey(key);
}

export function redactForPersistence(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return { redacted: true, reason: "max_depth" };
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactPersistenceString(value);
  if (Array.isArray(value)) {
    const visible = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactForPersistence(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      visible.push({ redacted: true, reason: "array_truncated", omitted_count: value.length - MAX_ARRAY_ITEMS });
    }
    return visible;
  }
  if (typeof value !== "object") return REDACTION_REPLACEMENT;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isHighRiskPersistenceKey(key)) {
      out[`${key}_redacted`] = summarizeRedactedValue(child, "sensitive_persistence_key");
      continue;
    }
    out[key] = redactForPersistence(child, depth + 1);
  }
  return out;
}

export function persistenceRedactionApplied(value: unknown): boolean {
  return JSON.stringify(redactForPersistence(value)) !== JSON.stringify(value);
}
