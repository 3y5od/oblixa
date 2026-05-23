/**
 * Optional IP allowlist for internal diagnostics (exact host strings or IPv4 CIDR).
 * Fail closed on malformed env.
 */
import { isIP } from "node:net";

export type InternalDiagAllowlistResult =
  | { ok: true; rules: string[] }
  | { ok: false; code: "DIAG_IPLIST_INVALID" };

function isIpv4(s: string): boolean {
  return isIP(s) === 4;
}

function ipv4ToInt(s: string): number {
  const parts = s.split(".").map((x) => Number(x));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, prefStr] = cidr.split("/");
  if (!isIpv4(base)) return false;
  const prefix = Number(prefStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isValidIpv4Cidr(rule: string): boolean {
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(rule);
  if (!match) return false;
  const [, base, prefixRaw] = match;
  const prefix = Number(prefixRaw);
  return isIpv4(base) && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

export function parseInternalDiagAllowlist(raw: string | undefined): InternalDiagAllowlistResult {
  if (!raw?.trim()) return { ok: true, rules: [] };
  const rules = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (rules.length === 0) return { ok: false, code: "DIAG_IPLIST_INVALID" };
  for (const r of rules) {
    if (r.includes("/")) {
      if (!isValidIpv4Cidr(r)) return { ok: false, code: "DIAG_IPLIST_INVALID" };
    } else if (isIP(r) === 0) {
      return { ok: false, code: "DIAG_IPLIST_INVALID" };
    }
  }
  return { ok: true, rules };
}

export function clientIpMatchesAllowlist(clientIp: string, rules: string[]): boolean {
  if (rules.length === 0) return true;
  for (const rule of rules) {
    if (rule.includes("/")) {
      if (isIpv4(clientIp) && ipv4InCidr(clientIp, rule)) return true;
    } else if (clientIp === rule) {
      return true;
    }
  }
  return false;
}
