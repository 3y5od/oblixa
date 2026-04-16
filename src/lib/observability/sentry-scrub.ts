const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-forwarded-authorization",
  "stripe-signature",
  "x-cron-secret",
  "x-vercel-cron-secret",
  "x-inbound-automation-token",
  "x-webhook-signature",
  "x-integration-token",
]);

/**
 * Redacts common secret-carrying headers before events leave the process.
 * Pair with sendDefaultPii: false (default) in client config.
 */
function scrubCalibrationPayloads<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const extra = o.extra;
  if (extra && typeof extra === "object") {
    const nextExtra = { ...(extra as Record<string, unknown>) };
    const redactKeys = [
      "onboarding_answers",
      "calibration_answers",
      "onboarding_calibration_json",
      "calibration_questionnaire",
      "calibration_wizard_payload",
      "rawMessage",
      "raw_message",
    ] as const;
    for (const key of redactKeys) {
      if (key in nextExtra) nextExtra[key] = "[redacted]";
    }
    o.extra = nextExtra;
  }
  return event;
}

export function scrubSentryEvent<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const req = o.request as { headers?: Record<string, string> } | undefined;
  const headers = req?.headers;
  if (!headers || typeof headers !== "object") return event;

  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
      next[key] = "[redacted]";
    } else {
      next[key] = value;
    }
  }
  (o.request as { headers: Record<string, string> }).headers = next;
  return scrubCalibrationPayloads(event);
}
