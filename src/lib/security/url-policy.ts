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
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isPrivateMappedV6(normalized: string): boolean {
  // Treat IPv4-mapped literals as non-public to avoid parser-based SSRF bypasses.
  return normalized.startsWith("::ffff:");
}

function parseIpv6Hextets(ip: string): number[] | null {
  let input = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(input) !== 6 || input.includes("%")) return null;

  const embeddedIpv4 = input.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  const ipv4Hextets: number[] = [];
  if (embeddedIpv4) {
    const parts = embeddedIpv4[2]!.split(".").map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
    ipv4Hextets.push((parts[0]! << 8) | parts[1]!, (parts[2]! << 8) | parts[3]!);
    input = embeddedIpv4[1]!.replace(/:$/, "");
  }

  const parts = input.split("::");
  if (parts.length > 2) return null;
  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const hextets = part.split(":");
    const parsed = hextets.map((segment) => Number.parseInt(segment, 16));
    if (
      parsed.some(
        (segment, index) =>
          !Number.isInteger(segment) ||
          segment < 0 ||
          segment > 0xffff ||
          !/^[0-9a-f]{1,4}$/i.test(hextets[index] ?? "")
      )
    ) {
      return null;
    }
    return parsed;
  };

  const left = parsePart(parts[0] ?? "");
  const right = parsePart(parts[1] ?? "");
  if (!left || !right) return null;
  if (parts.length === 1) {
    const exact = [...left, ...ipv4Hextets];
    return exact.length === 8 ? exact : null;
  }

  const missing = 8 - left.length - right.length - ipv4Hextets.length;
  if (missing < 0) return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right, ...ipv4Hextets];
}

function ipv6MatchesPrefix(ip: string, prefix: string, bits: number): boolean {
  const ipHextets = parseIpv6Hextets(ip);
  const prefixHextets = parseIpv6Hextets(prefix);
  if (!ipHextets || !prefixHextets || bits < 0 || bits > 128) return false;

  let remaining = bits;
  for (let i = 0; i < 8 && remaining > 0; i += 1) {
    const compareBits = Math.min(remaining, 16);
    const mask = compareBits === 16 ? 0xffff : (0xffff << (16 - compareBits)) & 0xffff;
    if ((ipHextets[i]! & mask) !== (prefixHextets[i]! & mask)) return false;
    remaining -= compareBits;
  }
  return true;
}

function isPrivateIpLiteral(hostname: string): boolean {
  const ipType = isIP(hostname);
  if (ipType === 0) return false;
  if (ipType === 4) {
    return isPrivateOrReservedV4(hostname);
  }
  // IPv6 loopback, compatibility, translation, documentation, link-local, ULA, and multicast ranges.
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    isPrivateMappedV6(normalized) ||
    ipv6MatchesPrefix(normalized, "::", 96) ||
    ipv6MatchesPrefix(normalized, "64:ff9b::", 96) ||
    ipv6MatchesPrefix(normalized, "100::", 64) ||
    ipv6MatchesPrefix(normalized, "2001:2::", 48) ||
    ipv6MatchesPrefix(normalized, "2001:10::", 28) ||
    ipv6MatchesPrefix(normalized, "2001:20::", 28) ||
    ipv6MatchesPrefix(normalized, "2001:db8::", 32) ||
    ipv6MatchesPrefix(normalized, "2002::", 16) ||
    ipv6MatchesPrefix(normalized, "3fff::", 20) ||
    ipv6MatchesPrefix(normalized, "fc00::", 7) ||
    ipv6MatchesPrefix(normalized, "fe80::", 10) ||
    ipv6MatchesPrefix(normalized, "ff00::", 8)
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
