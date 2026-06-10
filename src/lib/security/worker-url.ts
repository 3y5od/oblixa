/**
 * Validates `EXTRACTION_WORKER_BASE_URL` so server-side fetch cannot be pointed at
 * internal/metadata endpoints (basic SSRF hardening).
 */
import net from "node:net";
import { isBlockedOutboundIp } from "@/lib/security/safe-fetch";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata",
  "metadata.google.internal",
]);

function isPrivateOrMetadataHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".local")) return true;

  if (net.isIP(h)) return isBlockedOutboundIp(h);

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
