/**
 * CSP and related security header string builders (used by next.config.ts).
 * Covered by unit tests to prevent accidental directive drift.
 */
export function buildContentSecurityPolicy(isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://*.sentry-cdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vitals.vercel-insights.com https://vercel.live",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function buildStrictCspReportOnly(isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self'${isProd ? "" : " 'unsafe-eval'"}`,
    "worker-src 'self' blob:",
    "style-src 'self'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://*.sentry-cdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vitals.vercel-insights.com https://vercel.live",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function buildSecurityHeaders(input: {
  isProd: boolean;
  isVercel: boolean;
}): { key: string; value: string }[] {
  const csp = buildContentSecurityPolicy(input.isProd);
  const strictCspReportOnly = buildStrictCspReportOnly(input.isProd);
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
        "camera=(), microphone=(), geolocation=(), interest-cohort=(), usb=(), bluetooth=(), serial=(), hid=()",
    },
    { key: "Content-Security-Policy", value: csp },
    { key: "Content-Security-Policy-Report-Only", value: strictCspReportOnly },
  ];
  if (input.isVercel) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}
