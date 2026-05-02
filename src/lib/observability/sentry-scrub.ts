import { deepRedactEmailLikeInUnknown, redactEmailLikeSubstrings } from "@/lib/observability/log-redaction";
import rawBanlist from "./metric-label-sentry-banlist.json";

type MetricLabelBanlist = { deny_tag_keys?: string[] };
const banlist = rawBanlist as MetricLabelBanlist;
const SENTRY_DENY_TAG_KEYS = new Set(
  Array.isArray(banlist.deny_tag_keys) ? banlist.deny_tag_keys.map((k) => k.toLowerCase()) : []
);

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-forwarded-authorization",
  "stripe-signature",
  "x-slack-signature",
  "x-cron-secret",
  "x-vercel-cron-secret",
  "x-inbound-automation-token",
  "x-webhook-signature",
  "x-integration-token",
  "cf-access-jwt-assertion",
  "cf-access-token",
  "true-client-ip",
  "x-auth-request-email",
  "x-amz-security-token",
  "baggage",
  "tracestate",
  "x-forwarded-client-cert",
  "x-client-cert",
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

function scrubSentryUser<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const user = o.user;
  if (user && typeof user === "object") {
    const u = { ...(user as Record<string, unknown>) };
    if ("email" in u) u.email = "[redacted]";
    if (typeof u.username === "string" && u.username.includes("@")) u.username = "[redacted]";
    if (typeof u.ip_address === "string") u.ip_address = "[redacted]";
    o.user = u;
  }
  return event;
}

function scrubSentryRequestUrl<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const req = o.request as { url?: string; query_string?: string } | undefined;
  if (!req || typeof req !== "object") return event;
  if (typeof req.url === "string") {
    req.url = redactEmailLikeSubstrings(req.url, 8000);
  }
  if (typeof req.query_string === "string") {
    req.query_string = redactEmailLikeSubstrings(req.query_string, 4000);
  }
  return event;
}

function scrubSentryBreadcrumbs<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const crumbs = o.breadcrumbs;
  if (!Array.isArray(crumbs)) return event;
  o.breadcrumbs = crumbs.map((c) => {
    if (!c || typeof c !== "object") return c;
    const row = { ...(c as Record<string, unknown>) };
    if (row.data && typeof row.data === "object") {
      row.data = deepRedactEmailLikeInUnknown(row.data);
    }
    if (typeof row.message === "string") {
      row.message = redactEmailLikeSubstrings(row.message, 4000);
    }
    return row;
  });
  return event;
}

function scrubSentryDeniedTagKeys<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const tags = o.tags;
  if (!tags || typeof tags !== "object") return event;
  const next: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
    if (SENTRY_DENY_TAG_KEYS.has(key.toLowerCase())) continue;
    next[key] = value as string | number | boolean | null;
  }
  o.tags = next;
  return event;
}

function scrubSentryDeepExtras<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  if (o.extra && typeof o.extra === "object") {
    o.extra = deepRedactEmailLikeInUnknown(o.extra) as Record<string, unknown>;
  }
  if (o.contexts && typeof o.contexts === "object") {
    o.contexts = deepRedactEmailLikeInUnknown(o.contexts) as Record<string, unknown>;
  }
  if (o.tags && typeof o.tags === "object") {
    o.tags = deepRedactEmailLikeInUnknown(o.tags) as Record<string, string | number | boolean | null>;
  }
  return event;
}

export function scrubSentryEvent<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const req = o.request as { headers?: Record<string, string> } | undefined;
  const headers = req?.headers;
  if (headers && typeof headers === "object") {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
        next[key] = "[redacted]";
      } else {
        next[key] = value;
      }
    }
    (o.request as { headers: Record<string, string> }).headers = next;
  }
  let out = scrubCalibrationPayloads(event);
  out = scrubSentryDeepExtras(out);
  out = scrubSentryDeniedTagKeys(out);
  out = scrubSentryUser(out);
  out = scrubSentryRequestUrl(out);
  out = scrubSentryBreadcrumbs(out);
  return out;
}
