/**
 * Validates `EXTRACTION_WORKER_BASE_URL` so server-side fetch cannot be pointed at
 * internal/metadata endpoints (basic SSRF hardening).
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata",
  "metadata.google.internal",
]);

function isPrivateOrMetadataHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".local")) return true;

  if (h === "169.254.169.254") return true;

  const parts = h.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }

  if (h.includes(":")) {
    const lower = h.replace(/^\[|\]$/g, "");
    if (
      lower === "::1" ||
      lower.startsWith("fe80:") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd")
    ) {
      return true;
    }
  }

  return false;
}

function isProductionLike(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

/**
 * True if `explicitUrl` is a safe origin-only URL for outbound worker fetches.
 * In production, only `https:` is allowed (except we still block private hosts).
 */
export function isSafeExtractionWorkerOrigin(explicitUrl: string): boolean {
  const trimmed = explicitUrl.trim();
  if (!trimmed) return false;

  let u: URL;
  try {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    u = new URL(withScheme);
  } catch {
    return false;
  }

  if (u.username || u.password) return false;
  if (u.search || u.hash) return false;

  const pathOnly = u.pathname === "" ? "/" : u.pathname;
  if (pathOnly !== "/") return false;

  if (isPrivateOrMetadataHost(u.hostname)) return false;

  if (isProductionLike() && u.protocol !== "https:") {
    return false;
  }

  if (!isProductionLike() && u.protocol !== "http:" && u.protocol !== "https:") {
    return false;
  }

  return true;
}
