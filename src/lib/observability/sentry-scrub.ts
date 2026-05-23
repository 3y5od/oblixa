import {
  deepRedactEmailLikeInUnknown,
  redactSensitiveHeaders,
  redactSensitiveLogString,
} from "@/lib/observability/log-redaction";
import rawBanlist from "./metric-label-sentry-banlist.json";

type MetricLabelBanlist = { deny_tag_keys?: string[] };
const banlist = rawBanlist as MetricLabelBanlist;
const SENTRY_DENY_TAG_KEYS = new Set(
  Array.isArray(banlist.deny_tag_keys) ? banlist.deny_tag_keys.map((k) => k.toLowerCase()) : []
);

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
    req.url = redactSensitiveLogString(req.url, 8000);
  }
  if (typeof req.query_string === "string") {
    req.query_string = redactSensitiveLogString(req.query_string, 4000);
  }
  return event;
}

function scrubSentryMessage<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  if (typeof o.message === "string") {
    o.message = redactSensitiveLogString(o.message, 4000);
  }
  return event;
}

function scrubSentryExceptions<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const o = event as Record<string, unknown>;
  const exception = o.exception;
  if (!exception || typeof exception !== "object") return event;
  const values = (exception as { values?: unknown }).values;
  if (!Array.isArray(values)) return event;
  (exception as { values: unknown[] }).values = values.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const row = { ...(entry as Record<string, unknown>) };
    if (typeof row.value === "string") {
      row.value = redactSensitiveLogString(row.value, 4000);
    }
    if (typeof row.type === "string") {
      row.type = redactSensitiveLogString(row.type, 512);
    }
    return row;
  });
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
      row.message = redactSensitiveLogString(row.message, 4000);
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
    (o.request as { headers: Record<string, string> }).headers = redactSensitiveHeaders(headers);
  }
  let out = scrubCalibrationPayloads(event);
  out = scrubSentryDeepExtras(out);
  out = scrubSentryDeniedTagKeys(out);
  out = scrubSentryUser(out);
  out = scrubSentryRequestUrl(out);
  out = scrubSentryMessage(out);
  out = scrubSentryExceptions(out);
  out = scrubSentryBreadcrumbs(out);
  return out;
}
