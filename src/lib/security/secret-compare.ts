import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for UTF-8 secrets/tokens (avoids leaking length via timing).
 * Uses SHA-256 digests so inputs may differ in length.
 */
export function secureCompareUtf8(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** Returns the token after `Bearer `, or null. */
export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization || typeof authorization !== "string") return null;
  const m = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return m?.[1] ?? null;
}
