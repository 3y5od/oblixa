// This file configures the initialization of Sentry on the server.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryRelease } from "@/lib/observability/sentry-release";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";
import { parseSampleRate } from "@/lib/observability/sentry-sampling";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    release: getSentryRelease(),
    beforeSend: scrubSentryEvent,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0),
    // CPU profiles are optional; keep off unless you explicitly enable sampling.
    profilesSampleRate: parseSampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, 0),
    enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
  });
}
