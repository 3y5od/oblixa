/**
 * CSP and related security header string builders (used by next.config.ts).
 * Covered by unit tests to prevent accidental directive drift.
 */
export function buildContentSecurityPolicy(
  isProd: boolean,
  options?: {
    strictEnforcingStyleSrc?: boolean;
    strictEnforcingScriptSrc?: boolean;
    enforcingScriptHashes?: readonly string[] | string | null;
    upgradeInsecureRequests?: boolean;
  }
): string {
  const scriptSrc = buildEnforcingScriptSrc(isProd, options);
  const styleSrc =
    isProd && options?.strictEnforcingStyleSrc !== false
      ? "style-src 'self'"
      : "style-src 'self' 'unsafe-inline'";
  const imgSrc = buildImgSrc(isProd);
  const connectSrc = buildConnectSrc(isProd);
  const upgradeInsecureRequests = options?.upgradeInsecureRequests !== false;
  return [
    "default-src 'self'",
    scriptSrc,
    "script-src-attr 'none'",
    "worker-src 'self' blob:",
    styleSrc,
    imgSrc,
    "font-src 'self' data:",
    connectSrc,
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "child-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const CSP_SCRIPT_HASH_SOURCE_RE = /^'(?:sha256|sha384|sha512)-[A-Za-z0-9+/=]+'$/;
const CSP_NONCE_SOURCE_RE = /^[A-Za-z0-9+/_=-]{8,128}$/;
const SECURITY_HEADER_VALUE_UNSAFE_RE = /[\u0000-\u001f\u007f]/;
const SECURITY_REPORTING_ENDPOINT_GROUP = "csp-endpoint";
const SECURITY_REPORTING_ENDPOINT_PATH = "/api/security/csp-report";
export type TrustedTypesMode = "off" | "report-only" | "enforce";
export type CoepMode = "off" | "credentialless" | "require-corp";
const TRUSTED_TYPES_DIRECTIVE = "trusted-types oblixa default; require-trusted-types-for 'script'";
const DISABLED_PERMISSION_POLICY_FEATURES = [
  "accelerometer",
  "ambient-light-sensor",
  "autoplay",
  "battery",
  "browsing-topics",
  "camera",
  "conversion-measurement",
  "display-capture",
  "encrypted-media",
  "gamepad",
  "geolocation",
  "gyroscope",
  "hid",
  "interest-cohort",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "screen-wake-lock",
  "serial",
  "speaker-selection",
  "sync-xhr",
  "usb",
  "web-share",
  "xr-spatial-tracking",
  "bluetooth",
] as const;

function buildImgSrc(isProd: boolean): string {
  return [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    ...(isProd ? [] : ["http://127.0.0.1:54321", "http://localhost:54321"]),
    "https://*.stripe.com",
    "https://*.sentry-cdn.com",
  ].join(" ");
}

function buildConnectSrc(isProd: boolean): string {
  return [
    "connect-src",
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    ...(isProd
      ? []
      : [
          "http://127.0.0.1:54321",
          "http://localhost:54321",
          "ws://127.0.0.1:54321",
          "ws://localhost:54321",
        ]),
    "https://api.stripe.com",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://vitals.vercel-insights.com",
    "https://vercel.live",
  ].join(" ");
}

export function normalizeCspScriptHashSources(
  rawSources?: readonly string[] | string | null
): string[] {
  const values =
    typeof rawSources === "string" ? rawSources.split(/[,\s]+/) : Array.from(rawSources ?? []);
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const token = trimmed.startsWith("'") ? trimmed : `'${trimmed}'`;
    if (!CSP_SCRIPT_HASH_SOURCE_RE.test(token)) {
      throw new Error(`Invalid CSP script hash source: ${trimmed}`);
    }
    if (!seen.has(token)) {
      normalized.push(token);
      seen.add(token);
    }
  }
  return normalized;
}

export function normalizeCspScriptNonce(rawNonce?: string | null): string | null {
  const nonce = rawNonce?.trim();
  if (!nonce) return null;
  if (!CSP_NONCE_SOURCE_RE.test(nonce) || SECURITY_HEADER_VALUE_UNSAFE_RE.test(nonce)) {
    throw new Error("Invalid CSP script nonce source");
  }
  return nonce;
}

export function normalizeTrustedTypesMode(rawMode?: string | null): TrustedTypesMode {
  const mode = String(rawMode ?? "off").trim().toLowerCase();
  if (mode === "" || mode === "off" || mode === "0" || mode === "false") return "off";
  if (mode === "report-only" || mode === "report_only" || mode === "reportonly") return "report-only";
  if (mode === "enforce" || mode === "enforced" || mode === "1" || mode === "true") return "enforce";
  throw new Error(`Invalid Trusted Types mode: ${rawMode}`);
}

export function normalizeCoepMode(rawMode?: string | null): CoepMode {
  const mode = String(rawMode ?? "off").trim().toLowerCase();
  if (mode === "" || mode === "off" || mode === "0" || mode === "false") return "off";
  if (mode === "credentialless") return "credentialless";
  if (mode === "require-corp" || mode === "require_corp") return "require-corp";
  throw new Error(`Invalid COEP mode: ${rawMode}`);
}

function buildPermissionsPolicy(): string {
  return DISABLED_PERMISSION_POLICY_FEATURES.map((feature) => `${feature}=()`).join(", ");
}

function buildEnforcingScriptSrc(
  isProd: boolean,
  options?: {
    strictEnforcingScriptSrc?: boolean;
    enforcingScriptHashes?: readonly string[] | string | null;
  }
): string {
  if (isProd && options?.strictEnforcingScriptSrc !== false) {
    const hashes = normalizeCspScriptHashSources(options?.enforcingScriptHashes);
    return ["script-src", "'self'", ...hashes].join(" ");
  }
  return `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`;
}

function appendCspReportingDirectives(csp: string): string {
  return `${csp}; report-uri ${SECURITY_REPORTING_ENDPOINT_PATH}; report-to ${SECURITY_REPORTING_ENDPOINT_GROUP}`;
}

function buildReportingEndpointsHeader(): string {
  return `${SECURITY_REPORTING_ENDPOINT_GROUP}="${SECURITY_REPORTING_ENDPOINT_PATH}"`;
}

export function buildStrictCspReportOnly(
  isProd: boolean,
  /** Staged Next 16+ nonce path: set OBLIXA_CSP_REPORT_ONLY_SCRIPT_NONCE in next.config (build-time). */
  scriptNonceForReportOnly?: string | null,
  upgradeInsecureRequests = true
): string {
  const nonce = normalizeCspScriptNonce(scriptNonceForReportOnly);
  const imgSrc = buildImgSrc(isProd);
  const connectSrc = buildConnectSrc(isProd);
  const scriptSrc =
    nonce && nonce.length > 0
      ? `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`
      : `script-src 'self'${isProd ? "" : " 'unsafe-eval'"}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "script-src-attr 'none'",
    "worker-src 'self' blob:",
    "style-src 'self'",
    imgSrc,
    "font-src 'self' data:",
    connectSrc,
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "child-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

let memoCspKey = "";
let memoCsp: string | null = null;
let memoStrictCsp: string | null = null;

function getMemoizedCspPair(
  isProd: boolean,
  scriptNonceForReportOnly?: string | null,
  strictEnforcingStyleSrc?: boolean,
  strictEnforcingScriptSrc?: boolean,
  enforcingScriptHashes?: readonly string[] | string | null,
  upgradeInsecureRequests?: boolean
) {
  const normalizedScriptHashes = normalizeCspScriptHashSources(enforcingScriptHashes);
  const key = [
    isProd ? "1" : "0",
    scriptNonceForReportOnly ?? "",
    strictEnforcingStyleSrc ? "1" : "0",
    strictEnforcingScriptSrc ? "1" : "0",
    upgradeInsecureRequests === false ? "0" : "1",
    normalizedScriptHashes.join(","),
  ].join(":");
  if (memoCspKey === key && memoCsp && memoStrictCsp) {
    return { csp: memoCsp, strictCspReportOnly: memoStrictCsp };
  }
  memoCspKey = key;
  memoCsp = buildContentSecurityPolicy(isProd, {
    strictEnforcingStyleSrc,
    strictEnforcingScriptSrc,
    enforcingScriptHashes: normalizedScriptHashes,
    upgradeInsecureRequests,
  });
  memoStrictCsp = buildStrictCspReportOnly(isProd, scriptNonceForReportOnly, upgradeInsecureRequests !== false);
  return { csp: memoCsp, strictCspReportOnly: memoStrictCsp };
}

export function buildSecurityHeaders(input: {
  isProd: boolean;
  isVercel: boolean;
  /**
   * Non-Vercel production (self-hosted TLS termination): set env OBLIXA_SELF_HOSTED_HSTS=1
   * so browsers receive Strict-Transport-Security (Vercel already injects equivalent).
   */
  selfHostedHsts?: boolean;
  /** Optional nonce for Content-Security-Policy-Report-Only strict script-src (staged rollout). */
  cspReportOnlyScriptNonce?: string | null;
  /** Legacy compatibility flag. Prefer trustedTypesMode. */
  trustedTypesReportOnly?: boolean;
  /** Trusted Types rollout mode: off, report-only, or enforce. */
  trustedTypesMode?: TrustedTypesMode;
  /** Cross-Origin-Embedder-Policy rollout mode: off, credentialless, or require-corp. */
  coepMode?: CoepMode;
  /**
   * Production-only: drop style-src 'unsafe-inline' on the enforcing CSP by default.
   * Set `OBLIXA_CSP_STRICT_ENFORCING_STYLE=0` only for a documented compatibility rollback.
   */
  cspStrictEnforcingStyleSrc?: boolean;
  /**
   * Production-only: drop script-src 'unsafe-inline' on the enforcing CSP by default.
   * Inline scripts must be covered by hashes supplied through cspEnforcingScriptHashes.
   * Set `OBLIXA_CSP_STRICT_ENFORCING_SCRIPT=0` only for a documented compatibility rollback.
   */
  cspStrictEnforcingScriptSrc?: boolean;
  /** CSP hash sources for strict enforcing script-src, for example sha256-... */
  cspEnforcingScriptHashes?: readonly string[] | string | null;
  /**
   * Emit `upgrade-insecure-requests` only for HTTPS-capable deployments. Local
   * production starts run over HTTP and otherwise force browser navigation to HTTPS.
   */
  upgradeInsecureRequests?: boolean;
}): { key: string; value: string }[] {
  const transportSecurityEnabled =
    input.upgradeInsecureRequests ?? (input.isProd && (input.isVercel || Boolean(input.selfHostedHsts)));
  const { csp, strictCspReportOnly } = getMemoizedCspPair(
    input.isProd,
    input.cspReportOnlyScriptNonce,
    input.cspStrictEnforcingStyleSrc,
    input.cspStrictEnforcingScriptSrc,
    input.cspEnforcingScriptHashes,
    transportSecurityEnabled
  );
  const trustedTypesMode = input.trustedTypesMode ?? (input.trustedTypesReportOnly === true ? "report-only" : "off");
  const coepMode = input.coepMode ?? "off";
  const enforcingCsp =
    trustedTypesMode === "enforce" ? `${csp}; ${TRUSTED_TYPES_DIRECTIVE}` : csp;
  const reportOnlyCsp =
    trustedTypesMode === "report-only" ? `${strictCspReportOnly}; ${TRUSTED_TYPES_DIRECTIVE}` : strictCspReportOnly;
  const headers: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: buildPermissionsPolicy(),
    },
    { key: "Content-Security-Policy", value: appendCspReportingDirectives(enforcingCsp) },
    { key: "Content-Security-Policy-Report-Only", value: appendCspReportingDirectives(reportOnlyCsp) },
    { key: "Reporting-Endpoints", value: buildReportingEndpointsHeader() },
  ];
  if (coepMode !== "off") {
    headers.push({ key: "Cross-Origin-Embedder-Policy", value: coepMode });
  }
  const emitHsts =
    input.isProd && (input.isVercel || Boolean(input.selfHostedHsts));
  if (emitHsts) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return assertSafeHeaderValues(headers);
}

function assertSafeHeaderValues(headers: { key: string; value: string }[]) {
  for (const header of headers) {
    if (SECURITY_HEADER_VALUE_UNSAFE_RE.test(header.key) || SECURITY_HEADER_VALUE_UNSAFE_RE.test(header.value)) {
      throw new Error(`Unsafe security header value for ${header.key}`);
    }
  }
  return headers;
}

export function buildApiNoStoreHeaders(): { key: string; value: string }[] {
  return assertSafeHeaderValues([
    { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
    { key: "Pragma", value: "no-cache" },
    { key: "Expires", value: "0" },
    { key: "Surrogate-Control", value: "no-store" },
    { key: "Vary", value: "Cookie, Authorization" },
  ]);
}
