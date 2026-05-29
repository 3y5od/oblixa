/** Loose UUID (any version) — matches Postgres `uuid` text form. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type ContractStoragePathParts = {
  organizationId: string;
  contractId: string;
  objectId: string;
  fileName: string;
  legacyShape: boolean;
};

const CONTRACT_STORAGE_NAMESPACE = "org";
const CONTRACT_STORAGE_FILE_TAIL_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
const CONTRACT_STORAGE_FILE_NAME_UNSAFE_RE = /[/\\\0%\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/;

function isContractStorageFileNameSafe(fileName: string): boolean {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed !== fileName) return false;
  if (trimmed.length > 500) return false;
  if (trimmed === "." || trimmed === ".." || trimmed.startsWith(".")) return false;
  return !CONTRACT_STORAGE_FILE_NAME_UNSAFE_RE.test(trimmed);
}

/**
 * Contract file storage path: `org/{orgId}/{contractId}/{uuid}-{filename}`.
 * The parser also accepts the legacy three-segment shape so old stored rows
 * remain downloadable while new writes use the explicit namespace.
 */
export function parseContractStoragePath(path: string | null | undefined): ContractStoragePathParts | null {
  if (path == null || typeof path !== "string") return null;
  const p = path.trim();
  if (p.length === 0 || p.length > 1024) return null;
  if (p.includes("%")) return null;
  if (p.includes("..") || p.includes("\\") || p.includes("\0")) return null;

  const parts = p.split("/");
  let organizationId: string;
  let contractId: string;
  let tail: string;
  let legacyShape = false;
  if (parts.length === 4 && parts[0] === CONTRACT_STORAGE_NAMESPACE) {
    [, organizationId, contractId, tail] = parts;
  } else if (parts.length === 3) {
    legacyShape = true;
    [organizationId, contractId, tail] = parts;
  } else {
    return null;
  }

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(contractId)) return null;
  const match = tail.match(CONTRACT_STORAGE_FILE_TAIL_RE);
  if (!match || !UUID_RE.test(match[1]) || !isContractStorageFileNameSafe(match[2])) return null;
  return {
    organizationId,
    contractId,
    objectId: match[1],
    fileName: match[2],
    legacyShape,
  };
}

export function buildContractStoragePath(
  organizationId: string,
  contractId: string,
  safeFileName: string,
  objectId = crypto.randomUUID()
): string {
  if (!isUuid(organizationId) || !isUuid(contractId) || !isUuid(objectId)) {
    throw new Error("invalid_contract_storage_path_scope");
  }
  if (!isContractStorageFileNameSafe(safeFileName)) {
    throw new Error("invalid_contract_storage_file_name");
  }
  return `${CONTRACT_STORAGE_NAMESPACE}/${organizationId}/${contractId}/${objectId}-${safeFileName}`;
}

export function isContractStoragePathSafe(path: string | null | undefined): boolean {
  return parseContractStoragePath(path) !== null;
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isReasonableEmail(email: string): boolean {
  const t = email.trim();
  return t.length <= 254 && EMAIL_RE.test(t);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DAY_MS = 86_400_000;

type ParsedStrictIsoTimestamp = { ok: true; ms: number; normalized: string } | { ok: false };

function parseStrictUtcIsoTimestamp(raw: string): ParsedStrictIsoTimestamp {
  if (!ISO_TIMESTAMP_RE.test(raw)) return { ok: false };
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return { ok: false };
  const normalized = new Date(ms).toISOString();
  if (normalized !== raw && normalized.replace(".000Z", "Z") !== raw) {
    return { ok: false };
  }
  return { ok: true, ms, normalized };
}

export function isIsoDateOnly(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return false;
  const ms = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return false;
  const normalized = new Date(ms).toISOString().slice(0, 10);
  return normalized === trimmed;
}

export const JSON_UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const BIDI_CONTROL_RE = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;
const NON_JSON_WHITESPACE_CONTROL_CHAR_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const ROUTE_PARAM_UNSAFE_RE = /[\u0000-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069/%\\?#]/;

export function containsControlOrBidi(value: string): boolean {
  return CONTROL_CHAR_RE.test(value) || BIDI_CONTROL_RE.test(value);
}

export function isSafeRouteParam(value: string | null | undefined, options: { maxLength?: number } = {}): boolean {
  if (typeof value !== "string") return false;
  const maxLength = options.maxLength ?? 512;
  if (value.length === 0 || value.length > maxLength) return false;
  if (value.trim() !== value) return false;
  if (value === "." || value === "..") return false;
  return !ROUTE_PARAM_UNSAFE_RE.test(value);
}

export function validateBoundedString(
  value: unknown,
  options: { maxLength: number; allowEmpty?: boolean; allowTextWhitespaceControls?: boolean } = { maxLength: 500 }
): { ok: true; value: string } | { ok: false; error: "invalid_string" | "string_too_long" | "unsafe_characters" } {
  if (typeof value !== "string") return { ok: false, error: "invalid_string" };
  const trimmed = value.trim();
  if (!options.allowEmpty && trimmed.length === 0) return { ok: false, error: "invalid_string" };
  if (trimmed.length > options.maxLength) return { ok: false, error: "string_too_long" };
  const hasUnsafeText = options.allowTextWhitespaceControls
    ? BIDI_CONTROL_RE.test(trimmed) || NON_JSON_WHITESPACE_CONTROL_CHAR_RE.test(trimmed)
    : containsControlOrBidi(trimmed);
  if (hasUnsafeText) return { ok: false, error: "unsafe_characters" };
  return { ok: true, value: trimmed };
}

export function hasUnsafeJsonKey(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasUnsafeJsonKey(entry, seen));
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (JSON_UNSAFE_KEYS.has(key)) return true;
    if (hasUnsafeJsonKey(child, seen)) return true;
  }
  return false;
}

export function isJsonShapeWithinLimits(
  value: unknown,
  options: {
    maxDepth?: number;
    maxArrayLength?: number;
    maxKeys?: number;
    maxStringLength?: number;
    allowJsonWhitespaceControls?: boolean;
  } = {}
): boolean {
  const maxDepth = options.maxDepth ?? 8;
  const maxArrayLength = options.maxArrayLength ?? 100;
  const maxKeys = options.maxKeys ?? 100;
  const maxStringLength = options.maxStringLength ?? 2000;
  const hasUnsafeText = options.allowJsonWhitespaceControls
    ? (text: string) => BIDI_CONTROL_RE.test(text) || NON_JSON_WHITESPACE_CONTROL_CHAR_RE.test(text)
    : containsControlOrBidi;
  const seen = new WeakSet<object>();
  function visit(current: unknown, depth: number): boolean {
    if (typeof current === "string") return current.length <= maxStringLength && !hasUnsafeText(current);
    if (current === null || typeof current !== "object") return true;
    if (depth > maxDepth) return false;
    if (seen.has(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) {
      return current.length <= maxArrayLength && current.every((entry) => visit(entry, depth + 1));
    }
    const entries = Object.entries(current as Record<string, unknown>);
    if (entries.length > maxKeys) return false;
    return entries.every(([key, child]) => !JSON_UNSAFE_KEYS.has(key) && !hasUnsafeText(key) && visit(child, depth + 1));
  }
  return visit(value, 0);
}

export function parsePositiveIntParam(
  value: string | null | undefined,
  options: { defaultValue: number; max: number; min?: number }
): number {
  const min = options.min ?? 1;
  const parsed = Number(value ?? options.defaultValue);
  if (!Number.isFinite(parsed)) return options.defaultValue;
  return Math.max(min, Math.min(options.max, Math.floor(parsed)));
}

export function parseFixedSortKey<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseFixedEnumParam<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseBooleanParam(
  value: string | null | undefined,
  options: { defaultValue: boolean }
): { ok: true; value: boolean } | { ok: false; error: "invalid_boolean" } {
  const raw = value?.trim().toLowerCase();
  if (!raw) return { ok: true, value: options.defaultValue };
  if (raw === "1" || raw === "true") return { ok: true, value: true };
  if (raw === "0" || raw === "false") return { ok: true, value: false };
  return { ok: false, error: "invalid_boolean" };
}

export function parseIsoDateRange(
  input: { from?: string | null; to?: string | null },
  options: { maxDays: number }
): { ok: true; from?: string; to?: string } | { ok: false; error: "invalid_date" | "date_range_too_large" | "date_range_inverted" } {
  const from = input.from?.trim() || undefined;
  const to = input.to?.trim() || undefined;
  if ((from && !isIsoDateOnly(from)) || (to && !isIsoDateOnly(to))) return { ok: false, error: "invalid_date" };
  if (from && to) {
    const fromMs = Date.parse(`${from}T00:00:00.000Z`);
    const toMs = Date.parse(`${to}T00:00:00.000Z`);
    if (toMs < fromMs) return { ok: false, error: "date_range_inverted" };
    const days = Math.floor((toMs - fromMs) / 86_400_000) + 1;
    if (days > options.maxDays) return { ok: false, error: "date_range_too_large" };
  }
  return { ok: true, ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

export function parseIsoTimestampParam(
  value: string | null | undefined,
  options: { maxLookbackDays: number; maxFutureSkewMinutes?: number; now?: Date | number }
):
  | { ok: true; value?: string; date?: Date }
  | { ok: false; error: "invalid_timestamp" | "timestamp_too_old" | "timestamp_in_future" } {
  const raw = value?.trim();
  if (!raw) return { ok: true };
  const parsed = parseStrictUtcIsoTimestamp(raw);
  if (!parsed.ok) return { ok: false, error: "invalid_timestamp" };
  const nowMs = typeof options.now === "number" ? options.now : (options.now ?? new Date()).getTime();
  const maxFutureMs = (options.maxFutureSkewMinutes ?? 5) * 60_000;
  if (parsed.ms > nowMs + maxFutureMs) return { ok: false, error: "timestamp_in_future" };
  const maxLookbackMs = options.maxLookbackDays * DAY_MS;
  if (parsed.ms < nowMs - maxLookbackMs) return { ok: false, error: "timestamp_too_old" };
  return { ok: true, value: parsed.normalized, date: new Date(parsed.ms) };
}

export function parseFutureIsoTimestamp(
  value: string | null | undefined,
  options: { maxFutureDays: number; now?: Date | number }
):
  | { ok: true; value?: string; date?: Date }
  | { ok: false; error: "invalid_timestamp" | "timestamp_not_future" | "timestamp_too_far_in_future" } {
  const raw = value?.trim();
  if (!raw) return { ok: true };
  const parsed = parseStrictUtcIsoTimestamp(raw);
  if (!parsed.ok) return { ok: false, error: "invalid_timestamp" };
  const nowMs = typeof options.now === "number" ? options.now : (options.now ?? new Date()).getTime();
  if (parsed.ms <= nowMs) return { ok: false, error: "timestamp_not_future" };
  if (parsed.ms > nowMs + options.maxFutureDays * DAY_MS) {
    return { ok: false, error: "timestamp_too_far_in_future" };
  }
  return { ok: true, value: parsed.normalized, date: new Date(parsed.ms) };
}
