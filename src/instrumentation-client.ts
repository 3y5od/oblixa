// This file configures Sentry on the client. Requires NEXT_PUBLIC_SENTRY_DSN (same project DSN as SENTRY_DSN on the server).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryRelease } from "@/lib/observability/sentry-release";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";
import { parseSampleRate } from "@/lib/observability/sentry-sampling";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  const isProd = process.env.NODE_ENV === "production";

  Sentry.init({
    dsn,
    release: getSentryRelease(),
    beforeSend: scrubSentryEvent,
    tracesSampleRate: parseSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, isProd ? 0.1 : 1),
    enableLogs: !isProd,
    sendDefaultPii: false,
    integrations: [Sentry.replayIntegration()],
    replaysSessionSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
      isProd ? 0.05 : 0.1
    ),
    replaysOnErrorSampleRate: parseSampleRate(process.env.NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE, 1),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
