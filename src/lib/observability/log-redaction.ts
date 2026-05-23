/**
 * Shared PII-style redaction for server logs, Sentry payloads, and breadcrumbs (§5.3 + Appendix AH).
 * Does not replace auth — only reduces accidental email / long free-text leakage in diagnostics.
 */

const EMAIL_LIKE = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const SECRET_LIKE_VALUE =
  /\b(Bearer\s+[A-Za-z0-9._~+/=-]{8,}|(?:access|refresh|api|webhook|oauth|signed)[_-]?(?:token|secret|key|code)=?[A-Za-z0-9._~+/=-]{8,}|(?:sk|rk)_(?:live|test|proj)_[A-Za-z0-9._-]{8,}|sk-proj-[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{48,}|whsec_[A-Za-z0-9._-]{8,}|github_pat_[A-Za-z0-9_]{12,}|gh[pousr]_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/gi;
const SIGNED_URL_SECRET_PARAM =
  /([?&](?:token|signature|sig|code|access_token|refresh_token|api_key|key|X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|X-Goog-Signature|X-Goog-Credential|GoogleAccessId|AWSAccessKeyId|Policy)=)[^&#\s]+/gi;
const SENSITIVE_STRING_ASSIGNMENT =
  /\b((?:access[_-]?token|refresh[_-]?token|authorization|webhook[_-]?secret|oauth[_-]?code|api[_-]?key|signed[_-]?url|private[_-]?url|raw[_-]?(?:document|contract|body|payload|message)?[_-]?text|provider[_-]?(?:payload|response|error)|email[_-]?body|responder[_-]?text|recipient[_-]?email|customer[_-]?(?:email|name)|file[_-]?name|secret|token|password|signature|cookie)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^&\s,;]+)/gi;
const SENSITIVE_LOG_KEY =
  /(^|[_-])(access[_-]?token|refresh[_-]?token|bearer|authorization|webhook[_-]?secret|oauth[_-]?code|api[_-]?key|signed[_-]?url|private[_-]?url|raw[_-]?(?:document|contract|body|payload|message)?[_-]?text|provider[_-]?(?:payload|response|error)|email[_-]?body|responder[_-]?text|recipient[_-]?email|customer[_-]?(?:email|name)|file[_-]?name|secret|token|password|signature|cookie)([_-]|$)/i;
export const REDACTION_REPLACEMENT = "[redacted]";

export const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-forwarded-authorization",
  "stripe-signature",
  "x-slack-signature",
  "x-cron-secret",
  "x-vercel-cron-secret",
  "x-inbound-automation-token",
  "x-webhook-signature",
  "x-integration-token",
  "cf-access-jwt-assertion",
  "cf-access-token",
  "true-client-ip",
  "x-auth-request-email",
  "x-amz-security-token",
  "baggage",
  "tracestate",
  "x-forwarded-client-cert",
  "x-client-cert",
]);

export function redactEmailLikeSubstrings(input: string, maxLen = 8000): string {
  if (!input) return input;
  const clipped = input.length > maxLen ? `${input.slice(0, maxLen)}…` : input;
  return clipped.replace(EMAIL_LIKE, "[redacted]");
}

export function redactSensitiveLogString(input: string, maxLen = 8000): string {
  if (!input) return input;
  return redactEmailLikeSubstrings(input, maxLen)
    .replace(SIGNED_URL_SECRET_PARAM, `$1${REDACTION_REPLACEMENT}`)
    .replace(SECRET_LIKE_VALUE, REDACTION_REPLACEMENT)
    .replace(SENSITIVE_STRING_ASSIGNMENT, `$1${REDACTION_REPLACEMENT}`);
}

export function isSensitiveLogKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_HEADER_KEYS.has(normalized) || SENSITIVE_LOG_KEY.test(normalized);
}

export function redactSensitiveHeaders(headers: Headers | Record<string, unknown>): Record<string, string> {
  const entries = headers instanceof Headers ? [...headers.entries()] : Object.entries(headers);
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    out[key] = isSensitiveLogKey(key) ? REDACTION_REPLACEMENT : redactSensitiveLogString(String(value), 4000);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPostgrestErrorLikeRecord(value: Record<string, unknown>): value is Record<string, unknown> & { code: string } {
  return (
    typeof value.code === "string" &&
    (typeof value.message === "string" || typeof value.details === "string" || typeof value.hint === "string")
  );
}

function redactPostgrestErrorLikeRecord(value: Record<string, unknown> & { code: string }): Record<string, unknown> {
  const out: Record<string, unknown> = { code: redactSensitiveLogString(value.code, 128) };
  if (typeof value.status === "number") out.status = value.status;
  if (typeof value.name === "string") out.name = redactSensitiveLogString(value.name, 128);
  if ("message" in value) out.message = REDACTION_REPLACEMENT;
  if ("details" in value) out.details = REDACTION_REPLACEMENT;
  if ("hint" in value) out.hint = REDACTION_REPLACEMENT;
  return out;
}

/**
 * Deep-walk JSON-like structures and redact email-like substrings in every string leaf.
 */
export function deepRedactEmailLikeInUnknown(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max-depth]";
  if (typeof value === "string") return redactSensitiveLogString(value, 12_000);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => deepRedactEmailLikeInUnknown(v, depth + 1));
  if (isRecord(value) && isPostgrestErrorLikeRecord(value)) {
    return redactPostgrestErrorLikeRecord(value);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveLogKey(k) ? REDACTION_REPLACEMENT : deepRedactEmailLikeInUnknown(v, depth + 1);
  }
  return out;
}

/**
 * Safe one-line representation for `console.error` / structured logs when the value may be a PostgREST
 * payload, Error, or unknown object — never log raw user essays verbatim.
 */
export function formatUnknownForServerLog(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return redactSensitiveLogString(value, 4000);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) {
    return redactSensitiveLogString(`${value.name}: ${value.message}`, 4000);
  }
  try {
    const s = JSON.stringify(deepRedactEmailLikeInUnknown(value));
    return redactSensitiveLogString(s.length > 4000 ? `${s.slice(0, 4000)}…` : s, 6000);
  } catch {
    return "[unserializable]";
  }
}
