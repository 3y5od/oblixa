import config from "../../config/operational-edge-readiness.json";

export type EdgeCacheClass = "public-cacheable" | "public-metadata-asset" | "private-no-store";
export type EdgeReadinessIssue = {
  issue: string;
  target: string;
  detail?: string;
};

export type DnsExpectation = {
  host: string;
  type: string;
  required: boolean;
  expectedPattern?: string;
};

export type DnsObservation = {
  host: string;
  type: string;
  values: readonly string[];
};

export type TlsObservation = {
  host: string;
  validTo: string;
  issuer: string | null;
  subjectAltNames: readonly string[];
  protocol: string | null;
  redirectsToHttps: boolean;
  hstsHeader: string | null;
  mixedContentUrls: readonly string[];
};

export type EmailAuthObservation = {
  domain: string;
  spf: string | null;
  dkim: readonly string[];
  dmarc: string | null;
  mx: readonly string[];
  mtaSts: string | null;
  sendingDomain: string;
  bounceDomain: string | null;
  replyToDomain: string | null;
  environmentDomain: string;
};

export type EdgeCacheInput = {
  path: string;
  headers: Record<string, string | undefined>;
};

export const OPERATIONAL_EDGE_READINESS_CONFIG = config;

const REQUIRED_DNS_TYPES = new Set(config.dnsReadiness.requiredWhenStrict.map((type) => type.toUpperCase()));
const STRONG_DMARc_POLICY_RE = /\bp=(?:quarantine|reject)\b/iu;
const SPF_RE = /^v=spf1\b.*(?:~all|-all)\b/iu;
const TLS_PROTOCOL_ORDER = new Map([
  ["TLSv1", 1],
  ["TLSv1.1", 2],
  ["TLSv1.2", 3],
  ["TLSv1.3", 4],
]);

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizedHeader(headers: Record<string, string | undefined>, name: string): string {
  const direct = headers[name];
  if (direct) return direct;
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? "";
}

export function redactDnsValue(value: string): string {
  if (/^v=(?:spf1|dmarc1|dkim1|stsv1)\b/iu.test(value)) return value.replace(/\bp=[A-Za-z0-9/+_-]{12,}/gu, "p=<redacted>");
  if (/google-site-verification|verification|token|secret/iu.test(value)) return `[redacted-dns-token:${stableHash(value)}]`;
  if (value.length > 80) return `[redacted-dns-value:${stableHash(value)}]`;
  return value;
}

export function evaluateDnsReadiness(expectations: readonly DnsExpectation[], observations: readonly DnsObservation[]) {
  const issues: EdgeReadinessIssue[] = [];
  const redactedObservations = observations.map((observation) => ({
    ...observation,
    values: observation.values.map(redactDnsValue).sort((a, b) => a.localeCompare(b)),
  }));

  for (const expected of expectations) {
    const type = expected.type.toUpperCase();
    const matching = observations.find(
      (row) => row.host.toLowerCase() === expected.host.toLowerCase() && row.type.toUpperCase() === type,
    );
    const required = expected.required || REQUIRED_DNS_TYPES.has(type);
    if (!matching || matching.values.length === 0) {
      if (required) issues.push({ issue: "dns_record_missing", target: `${expected.host}:${type}`, detail: "provider_manual_boundary" });
      continue;
    }
    if (expected.expectedPattern) {
      const pattern = new RegExp(expected.expectedPattern, "iu");
      if (!matching.values.some((value) => pattern.test(value))) {
        issues.push({ issue: "dns_record_unexpected_value", target: `${expected.host}:${type}` });
      }
    }
  }

  return {
    ok: issues.length === 0,
    observationCount: observations.length,
    redactedObservations,
    issues,
  };
}

function daysUntil(dateValue: string, nowMs: number): number {
  const target = Date.parse(dateValue);
  if (!Number.isFinite(target)) return Number.NEGATIVE_INFINITY;
  return Math.floor((target - nowMs) / 86_400_000);
}

function protocolRank(protocol: string | null): number {
  return protocol ? TLS_PROTOCOL_ORDER.get(protocol) ?? 0 : 0;
}

export function evaluateTlsReadiness(
  observation: TlsObservation,
  options: { now?: string; minimumDaysRemaining?: number; minimumProtocol?: string } = {},
) {
  const issues: EdgeReadinessIssue[] = [];
  const nowMs = Date.parse(options.now ?? new Date().toISOString());
  const minimumDaysRemaining = options.minimumDaysRemaining ?? config.tlsReadiness.minimumDaysRemaining;
  const minimumProtocol = options.minimumProtocol ?? config.tlsReadiness.minimumProtocol;
  const remainingDays = daysUntil(observation.validTo, nowMs);

  if (remainingDays < minimumDaysRemaining) {
    issues.push({ issue: "tls_certificate_expiring", target: observation.host, detail: `${remainingDays}_days_remaining` });
  }
  if (!observation.issuer) issues.push({ issue: "tls_issuer_missing", target: observation.host });
  if (!observation.subjectAltNames.includes(observation.host) && !observation.subjectAltNames.includes(`*.${observation.host.split(".").slice(1).join(".")}`)) {
    issues.push({ issue: "tls_san_missing_host", target: observation.host });
  }
  if (protocolRank(observation.protocol) < protocolRank(minimumProtocol)) {
    issues.push({ issue: "tls_protocol_below_minimum", target: observation.host, detail: observation.protocol ?? "unknown" });
  }
  if (!observation.redirectsToHttps) issues.push({ issue: "edge_http_redirect_missing", target: observation.host });
  if (!observation.hstsHeader || !/max-age=\d+/iu.test(observation.hstsHeader)) {
    issues.push({ issue: "edge_hsts_missing", target: observation.host });
  }
  if (observation.mixedContentUrls.length > 0) {
    issues.push({ issue: "edge_mixed_content_risk", target: observation.host, detail: String(observation.mixedContentUrls.length) });
  }

  return {
    ok: issues.length === 0,
    host: observation.host,
    remainingDays,
    issues,
  };
}

export function evaluateEmailAuthReadiness(observation: EmailAuthObservation) {
  const issues: EdgeReadinessIssue[] = [];
  if (!observation.spf || !SPF_RE.test(observation.spf)) issues.push({ issue: "email_spf_not_enforcing", target: observation.domain });
  if (observation.dkim.length === 0) issues.push({ issue: "email_dkim_missing", target: observation.domain });
  if (!observation.dmarc || !STRONG_DMARc_POLICY_RE.test(observation.dmarc)) issues.push({ issue: "email_dmarc_not_enforcing", target: observation.domain });
  if (observation.mx.length === 0) issues.push({ issue: "email_mx_unclassified", target: observation.domain });
  if (!observation.mtaSts || !/^v=STSv1\b/iu.test(observation.mtaSts)) issues.push({ issue: "email_mta_sts_missing", target: observation.domain });
  if (!observation.sendingDomain.endsWith(observation.domain)) issues.push({ issue: "email_sending_domain_misaligned", target: observation.sendingDomain });
  if (observation.bounceDomain && !observation.bounceDomain.endsWith(observation.domain)) {
    issues.push({ issue: "email_bounce_domain_misaligned", target: observation.bounceDomain });
  }
  if (observation.replyToDomain && !observation.replyToDomain.endsWith(observation.domain)) {
    issues.push({ issue: "email_reply_to_domain_misaligned", target: observation.replyToDomain });
  }
  if (observation.environmentDomain === observation.domain && /(?:staging|preview|dev)\./iu.test(observation.sendingDomain)) {
    issues.push({ issue: "email_environment_domain_mixed", target: observation.sendingDomain });
  }
  return { ok: issues.length === 0, issues };
}

export function classifyEdgeCachePolicy(input: EdgeCacheInput) {
  const cacheControl = normalizedHeader(input.headers, "cache-control").toLowerCase();
  const vary = normalizedHeader(input.headers, "vary").toLowerCase();
  const surrogateControl = normalizedHeader(input.headers, "surrogate-control").toLowerCase();
  const isApi = input.path.startsWith("/api/");
  const isPrivate = config.publicMetadataReadiness.privatePrefixes.some((prefix) => input.path === prefix || input.path.startsWith(`${prefix}/`));
  const issues: EdgeReadinessIssue[] = [];
  const cacheClass: EdgeCacheClass = isApi || isPrivate ? "private-no-store" : input.path.startsWith("/opengraph-image") || input.path.startsWith("/twitter-image") || input.path.startsWith("/icon") || input.path.startsWith("/apple-icon") ? "public-metadata-asset" : "public-cacheable";

  if (cacheClass === "private-no-store") {
    if (!cacheControl.includes("no-store")) issues.push({ issue: "edge_private_cache_missing_no_store", target: input.path });
    if (isApi && !surrogateControl.includes("no-store")) issues.push({ issue: "edge_api_surrogate_cache_not_disabled", target: input.path });
    if (!vary.includes("cookie") || !vary.includes("authorization")) issues.push({ issue: "edge_private_vary_missing", target: input.path });
  } else if (!cacheControl) {
    issues.push({ issue: "edge_public_cache_unclassified", target: input.path });
  }

  if (cacheClass === "public-cacheable" && /(?:dashboard|api|settings|contracts|reports)/iu.test(cacheControl)) {
    issues.push({ issue: "edge_public_cache_contains_private_signal", target: input.path });
  }

  return { ok: issues.length === 0, cacheClass, issues };
}

export function buildEdgeReadinessFixtureReport(input: {
  dnsExpectations: readonly DnsExpectation[];
  dnsObservations: readonly DnsObservation[];
  tlsObservations: readonly TlsObservation[];
  emailObservations: readonly EmailAuthObservation[];
  cacheInputs: readonly EdgeCacheInput[];
  now?: string;
}) {
  const dns = evaluateDnsReadiness(input.dnsExpectations, input.dnsObservations);
  const tls = input.tlsObservations.map((observation) => evaluateTlsReadiness(observation, { now: input.now }));
  const email = input.emailObservations.map(evaluateEmailAuthReadiness);
  const cache = input.cacheInputs.map(classifyEdgeCachePolicy);
  return {
    ok: dns.ok && tls.every((row) => row.ok) && email.every((row) => row.ok) && cache.every((row) => row.ok),
    dns,
    tls,
    email,
    cache,
  };
}
