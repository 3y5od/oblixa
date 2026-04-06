/** Loose UUID (any version) — matches Postgres `uuid` text form. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * Contract file storage path: `{orgId}/{contractId}/{uuid}-{filename}`.
 * Rejects traversal, odd separators, and implausible shapes before DB lookup.
 */
export function isContractStoragePathSafe(path: string | null | undefined): boolean {
  if (path == null || typeof path !== "string") return false;
  const p = path.trim();
  if (p.length === 0 || p.length > 1024) return false;
  if (p.includes("..") || p.includes("\\") || p.includes("\0")) return false;
  const parts = p.split("/");
  if (parts.length !== 3) return false;
  if (!UUID_RE.test(parts[0]) || !UUID_RE.test(parts[1])) return false;
  const tail = parts[2];
  const fileTailRe =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
  const m = tail.match(fileTailRe);
  if (!m || !UUID_RE.test(m[1]) || m[2].length === 0 || m[2].length > 500) {
    return false;
  }
  return true;
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isReasonableEmail(email: string): boolean {
  const t = email.trim();
  return t.length <= 254 && EMAIL_RE.test(t);
}
