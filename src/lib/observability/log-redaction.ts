/**
 * Shared PII-style redaction for server logs, Sentry payloads, and breadcrumbs (§5.3 + Appendix AH).
 * Does not replace auth — only reduces accidental email / long free-text leakage in diagnostics.
 */

const EMAIL_LIKE = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;

export function redactEmailLikeSubstrings(input: string, maxLen = 8000): string {
  if (!input) return input;
  const clipped = input.length > maxLen ? `${input.slice(0, maxLen)}…` : input;
  return clipped.replace(EMAIL_LIKE, "[redacted]");
}

/**
 * Deep-walk JSON-like structures and redact email-like substrings in every string leaf.
 */
export function deepRedactEmailLikeInUnknown(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max-depth]";
  if (typeof value === "string") return redactEmailLikeSubstrings(value, 12_000);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => deepRedactEmailLikeInUnknown(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepRedactEmailLikeInUnknown(v, depth + 1);
  }
  return out;
}

/**
 * Safe one-line representation for `console.error` / structured logs when the value may be a PostgREST
 * payload, Error, or unknown object — never log raw user essays verbatim.
 */
export function formatUnknownForServerLog(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return redactEmailLikeSubstrings(value, 4000);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) {
    return redactEmailLikeSubstrings(`${value.name}: ${value.message}`, 4000);
  }
  try {
    const s = JSON.stringify(value);
    return redactEmailLikeSubstrings(s.length > 4000 ? `${s.slice(0, 4000)}…` : s, 6000);
  } catch {
    return "[unserializable]";
  }
}
