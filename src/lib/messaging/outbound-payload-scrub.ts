const SENSITIVE_KEY_RE =
  /(^|[_-])(authorization|bearer|cookie|set[_-]?cookie|api[_-]?key|apikey|token|secret|signature|signed[_-]?url|private[_-]?url|raw[_-]?(contract|document)?[_-]?text|document[_-]?text|file[_-]?(content|body))([_-]|$)/i;

const QUERY_SECRET_RE =
  /([?&](?:access_token|refresh_token|token|api_key|apikey|key|code|sig|signature|secret|policy|x-amz-signature|x-amz-credential|x-goog-signature|x-goog-credential)=)[^&#\s"'<>)]*/gi;

const COOKIE_RE = /\b(?:cookie|set-cookie)\s*[:=]\s*[^;\r\n]+/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const COMMON_SECRET_RE =
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_=-]{12,}\b|\bwhsec_[A-Za-z0-9_=-]{8,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

function limitString(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function isSensitiveOutboundKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

export function redactOutboundMessageText(value: string, maxLength = 4000): string {
  const redacted = String(value)
    .replace(PRIVATE_KEY_RE, "[redacted_private_key]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(JWT_RE, "[redacted_jwt]")
    .replace(COMMON_SECRET_RE, "[redacted_secret]")
    .replace(QUERY_SECRET_RE, "$1[redacted]")
    .replace(COOKIE_RE, (match) => `${match.split(/[:=]/, 1)[0]}=[redacted]`);
  return limitString(redacted, maxLength);
}

export function sanitizeOutboundHtml(html: string, maxLength = 14_000): string {
  return redactOutboundMessageText(html, maxLength)
    .replace(/<\s*(script|iframe|object|embed|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|meta|link)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\2/gi, ' $1="#"');
}

export function scrubOutboundPayloadValue(
  value: unknown,
  options: { maxDepth?: number; maxArrayLength?: number; maxKeys?: number; maxStringLength?: number } = {},
  key = "",
  depth = 0
): unknown {
  const maxDepth = options.maxDepth ?? 8;
  const maxArrayLength = options.maxArrayLength ?? 50;
  const maxKeys = options.maxKeys ?? 80;
  const maxStringLength = options.maxStringLength ?? 2000;

  if (key && isSensitiveOutboundKey(key)) return "[redacted]";
  if (typeof value === "string") return redactOutboundMessageText(value, maxStringLength);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= maxDepth) return "[truncated]";
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayLength)
      .map((entry) => scrubOutboundPayloadValue(entry, options, "", depth + 1));
  }
  if (typeof value !== "object") return null;

  const out: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>).slice(0, maxKeys)) {
    out[entryKey] = scrubOutboundPayloadValue(entryValue, options, entryKey, depth + 1);
  }
  return out;
}

export function scrubOutboundMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const scrubbed = scrubOutboundPayloadValue(metadata ?? {}, {
    maxDepth: 5,
    maxArrayLength: 20,
    maxKeys: 60,
    maxStringLength: 1000,
  });
  return scrubbed && typeof scrubbed === "object" && !Array.isArray(scrubbed)
    ? (scrubbed as Record<string, unknown>)
    : {};
}
