import { createHash } from "node:crypto";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";

const CONTACT_DUPLICATE_WINDOW_MS = 15 * 60_000;

const FIELD_MAX = {
  name: 200,
  email: 320,
  company: 200,
  role: 200,
  contracts: 64,
  interested: 64,
  trackingMethod: 64,
  hasTracker: 32,
  redactedSample: 32,
  preference: 32,
  accountableOwner: 32,
  procurementBeforeUpload: 32,
  smallFirstSet: 32,
  pain: 600,
  message: 4000,
} as const;

const ALLOWED_INTERESTED = ["request_access", "early_access", "general"] as const;
const ALLOWED_TRACKING_METHODS = [
  "spreadsheet",
  "shared_folder",
  "email_calendar",
  "memory",
  "mixed",
  "other",
] as const;
const ALLOWED_YES_NO_UNSURE = ["yes", "no", "unsure"] as const;
const ALLOWED_PREFERENCES = ["async", "call", "either"] as const;
const ALLOWED_OWNER = ["self", "named", "unsure"] as const;
const ALLOWED_PROCUREMENT = ["no", "maybe", "yes"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recentSubmissionDigests = new Map<string, number>();

const SELECT_VALUE_ALIASES: Record<string, Record<string, string>> = {
  interested: {
    "request access": "request_access",
    "workspace access": "request_access",
    "early access": "early_access",
    "general question": "general",
  },
  trackingMethod: {
    "shared folder": "shared_folder",
    "email or calendar reminders": "email_calendar",
    "email/calendar": "email_calendar",
    "someone's memory": "memory",
    "someone’s memory": "memory",
    "a mix of tools": "mixed",
  },
  yesNoUnsure: {
    select: "",
    yes: "yes",
    no: "no",
    unsure: "unsure",
    "not sure": "unsure",
  },
  preference: {
    async: "async",
    call: "call",
    either: "either",
    "async questions first": "async",
    "short call if there is a fit": "call",
    "either is fine": "either",
  },
  owner: {
    self: "self",
    named: "named",
    unsure: "unsure",
    "i can be the owner": "self",
    "i can name the owner": "named",
    "not sure yet": "unsure",
  },
  procurement: {
    no: "no",
    maybe: "maybe",
    yes: "yes",
  },
};

export type ContactBody = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  role?: unknown;
  contracts?: unknown;
  interested?: unknown;
  trackingMethod?: unknown;
  hasTracker?: unknown;
  redactedSample?: unknown;
  preference?: unknown;
  accountableOwner?: unknown;
  procurementBeforeUpload?: unknown;
  smallFirstSet?: unknown;
  pain?: unknown;
  message?: unknown;
  /** Honeypot - when filled by a bot, the route silently 204s without sending. */
  website?: unknown;
};

export type ContactPayload = {
  name: string;
  email: string;
  company: string;
  role: string;
  contracts: string;
  interested: string;
  trackingMethod: string;
  hasTracker: string;
  redactedSample: string;
  preference: string;
  accountableOwner: string;
  procurementBeforeUpload: string;
  smallFirstSet: string;
  pain: string;
  message: string;
};

export type ContactNotificationResult =
  | { configured: false; delivered: false }
  | { configured: true; delivered: true }
  | { configured: true; delivered: false };

function trimOrEmpty(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function normalizeKnownSelectValue(value: string, aliases: Record<string, string>): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return aliases[trimmed.toLowerCase().replace(/\s+/g, " ")] ?? trimmed;
}

export function asContactRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function isContactHoneypotFilled(body: ContactBody): boolean {
  return typeof body.website === "string" && body.website.trim().length > 0;
}

export function normalizeContactPayload(body: ContactBody): ContactPayload {
  const hasTracker = normalizeKnownSelectValue(
    trimOrEmpty(body.hasTracker, FIELD_MAX.hasTracker),
    SELECT_VALUE_ALIASES.yesNoUnsure
  );
  const redactedSample = normalizeKnownSelectValue(
    trimOrEmpty(body.redactedSample, FIELD_MAX.redactedSample),
    SELECT_VALUE_ALIASES.yesNoUnsure
  );
  return {
    name: trimOrEmpty(body.name, FIELD_MAX.name),
    email: trimOrEmpty(body.email, FIELD_MAX.email),
    company: trimOrEmpty(body.company, FIELD_MAX.company),
    role: trimOrEmpty(body.role, FIELD_MAX.role),
    contracts: trimOrEmpty(body.contracts, FIELD_MAX.contracts),
    interested: normalizeKnownSelectValue(
      trimOrEmpty(body.interested, FIELD_MAX.interested),
      SELECT_VALUE_ALIASES.interested
    ),
    trackingMethod: normalizeKnownSelectValue(
      trimOrEmpty(body.trackingMethod, FIELD_MAX.trackingMethod),
      SELECT_VALUE_ALIASES.trackingMethod
    ),
    hasTracker: hasTracker || "unsure",
    redactedSample: redactedSample || "unsure",
    preference: normalizeKnownSelectValue(
      trimOrEmpty(body.preference, FIELD_MAX.preference),
      SELECT_VALUE_ALIASES.preference
    ),
    accountableOwner: normalizeKnownSelectValue(
      trimOrEmpty(body.accountableOwner, FIELD_MAX.accountableOwner),
      SELECT_VALUE_ALIASES.owner
    ),
    procurementBeforeUpload: normalizeKnownSelectValue(
      trimOrEmpty(body.procurementBeforeUpload, FIELD_MAX.procurementBeforeUpload),
      SELECT_VALUE_ALIASES.procurement
    ),
    smallFirstSet: normalizeKnownSelectValue(
      trimOrEmpty(body.smallFirstSet, FIELD_MAX.smallFirstSet),
      SELECT_VALUE_ALIASES.yesNoUnsure
    ),
    pain: trimOrEmpty(body.pain, FIELD_MAX.pain),
    message: trimOrEmpty(body.message, FIELD_MAX.message),
  };
}

export function validateContactPayload(payload: ContactPayload): string | null {
  if (
    !payload.name ||
    !payload.email ||
    !payload.company ||
    !payload.role ||
    !payload.contracts ||
    !payload.interested ||
    !payload.trackingMethod ||
    !payload.preference ||
    !payload.pain
  ) {
    return "missing_required";
  }
  if (!EMAIL_RE.test(payload.email)) return "invalid_email";
  if (!(ALLOWED_INTERESTED as readonly string[]).includes(payload.interested)) return "invalid_interested";
  if (!(ALLOWED_TRACKING_METHODS as readonly string[]).includes(payload.trackingMethod)) return "invalid_tracking_method";
  if (!(ALLOWED_YES_NO_UNSURE as readonly string[]).includes(payload.hasTracker)) return "invalid_has_tracker";
  if (!(ALLOWED_YES_NO_UNSURE as readonly string[]).includes(payload.redactedSample)) return "invalid_redacted_sample";
  if (!(ALLOWED_PREFERENCES as readonly string[]).includes(payload.preference)) return "invalid_preference";
  if (payload.accountableOwner && !(ALLOWED_OWNER as readonly string[]).includes(payload.accountableOwner)) {
    return "invalid_accountable_owner";
  }
  if (
    payload.procurementBeforeUpload &&
    !(ALLOWED_PROCUREMENT as readonly string[]).includes(payload.procurementBeforeUpload)
  ) {
    return "invalid_procurement";
  }
  if (payload.smallFirstSet && !(ALLOWED_YES_NO_UNSURE as readonly string[]).includes(payload.smallFirstSet)) {
    return "invalid_small_first_set";
  }
  return null;
}

export function hasDuplicateContactSubmission(payload: ContactPayload): boolean {
  const now = Date.now();
  for (const [digest, expiresAt] of recentSubmissionDigests.entries()) {
    if (expiresAt <= now) recentSubmissionDigests.delete(digest);
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        name: payload.name.toLowerCase(),
        email: payload.email.toLowerCase(),
        company: payload.company.toLowerCase(),
        role: payload.role.toLowerCase(),
        contracts: payload.contracts,
        interested: payload.interested,
        trackingMethod: payload.trackingMethod,
        hasTracker: payload.hasTracker,
        redactedSample: payload.redactedSample,
        preference: payload.preference,
        accountableOwner: payload.accountableOwner,
        procurementBeforeUpload: payload.procurementBeforeUpload,
        smallFirstSet: payload.smallFirstSet,
        pain: payload.pain,
        message: payload.message,
      })
    )
    .digest("hex");
  if (recentSubmissionDigests.has(digest)) return true;
  recentSubmissionDigests.set(digest, now + CONTACT_DUPLICATE_WINDOW_MS);
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const RESEND_EMAILS_URL = validateOutboundHttpUrl("https://api.resend.com/emails");

function formatContactDeliveryError(err: unknown): { name: string } {
  if (err instanceof Error) return { name: err.name || "Error" };
  return { name: typeof err };
}

export async function sendNotificationEmail(payload: ContactPayload): Promise<ContactNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to = process.env.CONTACT_NOTIFY_EMAIL?.trim();
  if (!apiKey || !from || !to || !RESEND_EMAILS_URL) {
    console.info("[contact] notification email provider not configured", {
      interested: payload.interested,
    });
    return { configured: false, delivered: false };
  }
  const interestedLabel =
    {
      request_access: "Access request",
      early_access: "Access request",
      general: "General question",
    }[payload.interested] ?? payload.interested;

  const rows: Array<[string, string]> = [
    ["Name", payload.name],
    ["Work email", payload.email],
    ["Company", payload.company],
    ["Role", payload.role],
    ["Approx. signed contracts", payload.contracts],
    ["Request type", interestedLabel],
    ["How tracked today", payload.trackingMethod],
    ["Existing spreadsheet/tracker", payload.hasTracker],
    ["Small first set", payload.smallFirstSet],
    ["Redacted sample shareable", payload.redactedSample],
    ["Accountable owner", payload.accountableOwner],
    ["Follow-up preference", payload.preference],
    ["Procurement/security before upload", payload.procurementBeforeUpload],
    ["Main pain", payload.pain],
    ["Message", payload.message],
  ];

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827; font-size: 18px;">New Oblixa contact form submission</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding: 8px 12px 8px 0; color: #6b7280; vertical-align: top; width: 140px;">${escapeHtml(
                label
              )}</td><td style="padding: 8px 0; color: #111827; white-space: pre-wrap;">${escapeHtml(
                value || "—"
              )}</td></tr>`
          )
          .join("")}
      </table>
    </div>
  `;

  try {
    const res = await safeFetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[Oblixa contact] ${payload.name} (${interestedLabel})`,
        reply_to: payload.email,
        html,
      }),
    });
    if (!res.ok) {
      throw new Error(`Email provider send failed (${res.status})`);
    }
    return { configured: true, delivered: true };
  } catch (err) {
    console.error("[contact] notification email failed", formatContactDeliveryError(err));
    return { configured: true, delivered: false };
  }
}
