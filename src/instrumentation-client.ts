// This file configures Sentry on the client. Requires NEXT_PUBLIC_SENTRY_DSN (same project DSN as SENTRY_DSN on the server).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  const isProd = process.env.NODE_ENV === "production";

  Sentry.init({
    dsn,
    tracesSampleRate: numEnv(
      "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
      isProd ? 0.1 : 1
    ),
    enableLogs: !isProd,
    sendDefaultPii: false,
    integrations: [Sentry.replayIntegration()],
    replaysSessionSampleRate: numEnv(
      "NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE",
      isProd ? 0.05 : 0.1
    ),
    replaysOnErrorSampleRate: numEnv(
      "NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE",
      1
    ),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
