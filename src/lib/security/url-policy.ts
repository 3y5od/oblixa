import { isIP } from "node:net";

const PRIVATE_V4_PREFIXES = [
  "10.",
  "127.",
  "169.254.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
];

function isPrivateIpLiteral(hostname: string): boolean {
  const ipType = isIP(hostname);
  if (ipType === 0) return false;
  if (ipType === 4) {
    return PRIVATE_V4_PREFIXES.some((prefix) => hostname.startsWith(prefix));
  }
  // IPv6 loopback/link-local/ULA
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
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
  const host = url.hostname.trim().toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (isPrivateIpLiteral(host)) return null;
  return url;
}
