import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { buildApiNoStoreHeaders, buildSecurityHeaders, resolveSecurityHeaderRollout } from "@/lib/security/csp-builders";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isProd = process.env.NODE_ENV === "production";
const isVercel = Boolean(process.env.VERCEL);
const enableSentryNextConfig =
  isProd ||
  Boolean(process.env.CI) ||
  process.env.OBLIXA_ENABLE_SENTRY_DEV === "1";
const selfHostedHsts = process.env.OBLIXA_SELF_HOSTED_HSTS === "1";
const {
  trustedTypesMode,
  coepMode,
  cspStrictEnforcingStyleSrc,
  cspStrictEnforcingScriptSrc,
  upgradeInsecureRequests,
} = resolveSecurityHeaderRollout({
  env: process.env,
  isProd,
  isVercel,
  selfHostedHsts,
});

const sentryRelease =
  process.env.SENTRY_RELEASE?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.GITHUB_SHA?.trim();

const securityHeaders = buildSecurityHeaders({
  isProd,
  isVercel,
  selfHostedHsts,
  cspReportOnlyScriptNonce: process.env.OBLIXA_CSP_REPORT_ONLY_SCRIPT_NONCE?.trim() || undefined,
  trustedTypesMode,
  coepMode,
  cspStrictEnforcingStyleSrc: cspStrictEnforcingStyleSrc,
  cspStrictEnforcingScriptSrc: cspStrictEnforcingScriptSrc,
  cspEnforcingScriptHashes: process.env.OBLIXA_CSP_ENFORCING_SCRIPT_HASHES,
  upgradeInsecureRequests,
});
const apiNoStoreHeaders = buildApiNoStoreHeaders();

const nextConfig: NextConfig = {
  ...(sentryRelease
    ? { env: { NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease } }
    : {}),
  /** gzip for Node server responses; CDN may apply Brotli at edge (EXT). */
  compress: true,
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  /** Hide the dev-only on-page indicator so it doesn't pollute the UI / QA captures. */
  devIndicators: false,
  serverExternalPackages: [
    "@react-pdf/renderer",
    "mammoth",
    "openai",
    "pdf-parse",
    "stripe",
  ],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "clsx", "next-themes"],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: apiNoStoreHeaders,
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const configuredNextConfig = withBundleAnalyzer(nextConfig);
const sentryNextConfigOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "na-5f1",

  project: "oblixa",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Widen uploads in CI only — full uploads noticeably slow local iteration.
  widenClientFileUpload: Boolean(process.env.CI),

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
};

export default enableSentryNextConfig
  ? withSentryConfig(configuredNextConfig, sentryNextConfigOptions)
  : configuredNextConfig;
