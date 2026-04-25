/**
 * IPv4/IPv6 CIDR validation helpers (admin / webhook allowlist UI — Tier 75 plan).
 */
const IPV4_CIDR = /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[12][0-9]|3[0-2])$/;
const IPV6_CIDR = /^[0-9a-fA-F:.]+\/\d{1,3}$/;

export function isPlausibleCidrLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.includes("/")) {
    if (t.includes(":")) return IPV6_CIDR.test(t);
    return IPV4_CIDR.test(t);
  }
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(t) || /^[0-9a-fA-F:]{2,}$/.test(t);
}
