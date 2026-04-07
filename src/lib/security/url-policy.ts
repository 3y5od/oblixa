import { isIP } from "node:net";

function isPrivateOrReservedV4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  // Private, loopback, link-local, and other non-public ranges often used for SSRF pivots.
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isPrivateMappedV6(normalized: string): boolean {
  // Treat IPv4-mapped literals as non-public to avoid parser-based SSRF bypasses.
  return normalized.startsWith("::ffff:");
}

function isPrivateIpLiteral(hostname: string): boolean {
  const ipType = isIP(hostname);
  if (ipType === 0) return false;
  if (ipType === 4) {
    return isPrivateOrReservedV4(hostname);
  }
  // IPv6 loopback/link-local/ULA
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    isPrivateMappedV6(normalized)
  );
}

export function validateOutboundHttpUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  const host = url.hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (isPrivateIpLiteral(host)) return null;
  return url;
}
