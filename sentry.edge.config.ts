// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate:
      Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0") || 0,
    enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
  });
}
