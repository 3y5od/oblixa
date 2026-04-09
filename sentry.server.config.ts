// This file configures the initialization of Sentry on the server.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryRelease } from "@/lib/observability/sentry-release";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    release: getSentryRelease(),
    tracesSampleRate:
      Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0") || 0,
    // CPU profiles are optional; keep off unless you explicitly enable sampling.
    profilesSampleRate:
      Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0") || 0,
    enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
  });
}
