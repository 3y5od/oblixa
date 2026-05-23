import { createHash, timingSafeEqual } from "node:crypto";

export function publicTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function publicTokenPrefix(token: string): string {
  return token.slice(0, 12);
}

export function publicTokenStableKey(token: string): string {
  return publicTokenHash(token).slice(0, 32);
}

export function publicTokenHashMatches(storedHash: unknown, tokenHash: string): boolean {
  const stored = typeof storedHash === "string" ? storedHash : "";
  try {
    return !!stored && timingSafeEqual(Buffer.from(stored, "utf8"), Buffer.from(tokenHash, "utf8"));
  } catch {
    return false;
  }
}

export function publicTokenMatches(row: { token_hash?: unknown }, token: string): boolean {
  return publicTokenHashMatches(row.token_hash, publicTokenHash(token));
}
