/**
 * CSP and related security header string builders (used by next.config.ts).
 * Covered by unit tests to prevent accidental directive drift.
 */
export function buildContentSecurityPolicy(
  isProd: boolean,
  options?: { strictEnforcingStyleSrc?: boolean }
): string {
  const styleSrc =
    isProd && options?.strictEnforcingStyleSrc === true
      ? "style-src 'self'"
      : "style-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "worker-src 'self' blob:",
    styleSrc,
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://*.sentry-cdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vitals.vercel-insights.com https://vercel.live",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export function buildStrictCspReportOnly(
  isProd: boolean,
  /** Staged Next 16+ nonce path: set OBLIXA_CSP_REPORT_ONLY_SCRIPT_NONCE in next.config (build-time). */
  scriptNonceForReportOnly?: string | null
): string {
  const nonce = scriptNonceForReportOnly?.trim();
  const scriptSrc =
    nonce && nonce.length > 0
      ? `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`
      : `script-src 'self'${isProd ? "" : " 'unsafe-eval'"}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://*.sentry-cdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vitals.vercel-insights.com https://vercel.live",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

let memoCspKey = "";
let memoCsp: string | null = null;
let memoStrictCsp: string | null = null;

function getMemoizedCspPair(
  isProd: boolean,
  scriptNonceForReportOnly?: string | null,
  strictEnforcingStyleSrc?: boolean
) {
  const key = `${isProd}:${scriptNonceForReportOnly ?? ""}:${strictEnforcingStyleSrc ? "1" : "0"}`;
  if (memoCspKey === key && memoCsp && memoStrictCsp) {
    return { csp: memoCsp, strictCspReportOnly: memoStrictCsp };
  }
  memoCspKey = key;
  memoCsp = buildContentSecurityPolicy(isProd, { strictEnforcingStyleSrc });
  memoStrictCsp = buildStrictCspReportOnly(isProd, scriptNonceForReportOnly);
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
  /** Append Trusted Types report-only directive to CSP-RO (set OBLIXA_TRUSTED_TYPES_REPORT_ONLY=1). */
  trustedTypesReportOnly?: boolean;
  /**
   * Production-only: drop style-src 'unsafe-inline' on the enforcing CSP (can break inline styles).
   * Set from next.config when `OBLIXA_CSP_STRICT_ENFORCING_STYLE=1` at build time.
   */
  cspStrictEnforcingStyleSrc?: boolean;
}): { key: string; value: string }[] {
  const { csp, strictCspReportOnly } = getMemoizedCspPair(
    input.isProd,
    input.cspReportOnlyScriptNonce,
    input.cspStrictEnforcingStyleSrc
  );
  const strictWithTt =
    input.trustedTypesReportOnly === true
      ? `${strictCspReportOnly}; require-trusted-types-for 'script'`
      : strictCspReportOnly;
  const headers: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), display-capture=(), web-share=(), interest-cohort=(), usb=(), bluetooth=(), serial=(), hid=()",
    },
    { key: "Content-Security-Policy", value: csp },
    { key: "Content-Security-Policy-Report-Only", value: strictWithTt },
  ];
  const emitHsts =
    input.isProd && (input.isVercel || Boolean(input.selfHostedHsts));
  if (emitHsts) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}
