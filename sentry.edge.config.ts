// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryRelease } from "@/lib/observability/sentry-release";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    release: getSentryRelease(),
    beforeSend: scrubSentryEvent,
    tracesSampleRate:
      Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0") || 0,
    profilesSampleRate:
      Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0") || 0,
    enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
  });
}
