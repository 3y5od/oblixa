import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  jsonBadRequest,
  jsonRateLimited,
  jsonUnhandled,
  PRIVATE_NO_STORE_HEADERS,
} from "@/lib/http/problem";
import { rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { BODY_LIMIT_SMALL_JSON, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getTrustedClientIpFromRequest } from "@/lib/security/trusted-forwarded";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { createAdminClient } from "@/lib/supabase/server";
import { insertAccessRequestRecord } from "@/lib/access-review";

const ROUTE = "/api/contact";
const CONTACT_DUPLICATE_WINDOW_MS = 15 * 60_000;

export const maxDuration = 60;

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recentSubmissionDigests = new Map<string, number>();

type ContactBody = {
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
  pain?: unknown;
  message?: unknown;
  /** Honeypot — when filled by a bot, we silently 204 without sending. */
  website?: unknown;
};

function trimOrEmpty(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasDuplicateContactSubmission(payload: {
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
  pain: string;
  message: string;
}): boolean {
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

async function sendNotificationEmail(payload: {
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
  pain: string;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to = process.env.CONTACT_NOTIFY_EMAIL?.trim();
  if (!apiKey || !from || !to || !RESEND_EMAILS_URL) {
    // Email not configured: keep only low-cardinality operational metadata.
    console.info("[contact] form submitted (email provider not configured)", {
      interested: payload.interested,
    });
    return;
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
    ["Redacted sample shareable", payload.redactedSample],
    ["Follow-up preference", payload.preference],
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
  } catch (err) {
    // Swallow — we already accepted the submission. Log and move on.
    console.error("[contact] notification email failed", formatContactDeliveryError(err));
  }
}

export async function POST(request: Request) {
  // Rate limit per trusted client IP.
  const ip = await getTrustedClientIpFromRequest(request);
  const rl = await rateLimitCheck(`${ROUTE}:${ip}`, RATE_LIMITS.marketingContact);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const parsed = await readJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON);
  if (!parsed.ok) return parsed.response;

  const body = asRecord(parsed.body) as ContactBody | null;
  if (!body) {
    return jsonBadRequest(ROUTE, { reason: "missing_body" });
  }

  // Honeypot — if a bot filled the hidden "website" field, return 204 without sending.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const name = trimOrEmpty(body.name, FIELD_MAX.name);
  const email = trimOrEmpty(body.email, FIELD_MAX.email);
  const company = trimOrEmpty(body.company, FIELD_MAX.company);
  const role = trimOrEmpty(body.role, FIELD_MAX.role);
  const contracts = trimOrEmpty(body.contracts, FIELD_MAX.contracts);
  const interested = trimOrEmpty(body.interested, FIELD_MAX.interested);
  const trackingMethod = trimOrEmpty(body.trackingMethod, FIELD_MAX.trackingMethod);
  const hasTracker = trimOrEmpty(body.hasTracker, FIELD_MAX.hasTracker);
  const redactedSample = trimOrEmpty(body.redactedSample, FIELD_MAX.redactedSample);
  const preference = trimOrEmpty(body.preference, FIELD_MAX.preference);
  const pain = trimOrEmpty(body.pain, FIELD_MAX.pain);
  const message = trimOrEmpty(body.message, FIELD_MAX.message);

  if (
    !name ||
    !email ||
    !company ||
    !role ||
    !contracts ||
    !interested ||
    !trackingMethod ||
    !preference ||
    !pain
  ) {
    return jsonBadRequest(ROUTE, { reason: "missing_required" });
  }
  if (!EMAIL_RE.test(email)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_email" });
  }
  if (!(ALLOWED_INTERESTED as readonly string[]).includes(interested)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_interested" });
  }
  if (!(ALLOWED_TRACKING_METHODS as readonly string[]).includes(trackingMethod)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_tracking_method" });
  }
  const hasTrackerForReview = hasTracker || "unsure";
  const redactedSampleForReview = redactedSample || "unsure";

  if (!(ALLOWED_YES_NO_UNSURE as readonly string[]).includes(hasTrackerForReview)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_has_tracker" });
  }
  if (!(ALLOWED_YES_NO_UNSURE as readonly string[]).includes(redactedSampleForReview)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_redacted_sample" });
  }
  if (!(ALLOWED_PREFERENCES as readonly string[]).includes(preference)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_preference" });
  }

  const isAccessIntent = interested === "request_access" || interested === "early_access";
  const isShortWindowDuplicate = hasDuplicateContactSubmission({
    name,
    email,
    company,
    role,
    contracts,
    interested,
    trackingMethod,
    hasTracker: hasTrackerForReview,
    redactedSample: redactedSampleForReview,
    preference,
    pain,
    message,
  });

  if (isShortWindowDuplicate && !isAccessIntent) {
    return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
  }

  if (isAccessIntent) {
    try {
      const admin = await createAdminClient();
      const inserted = await insertAccessRequestRecord(admin, {
        normalizedEmail: email,
        requesterName: name,
        companyName: company,
        requesterRole: role,
        approximateContractCount: contracts,
        currentTrackingMethod: trackingMethod,
        hasTracker: hasTrackerForReview,
        redactedSampleAvailable: redactedSampleForReview,
        followUpPreference: preference,
        painSummary: pain,
        message,
        source: "request_access",
      });
      if (!inserted.ok) {
        console.error("[contact] access request persistence failed", { reason: inserted.error });
        return jsonUnhandled(ROUTE);
      }
    } catch {
      console.error("[contact] access request persistence failed", { reason: "unavailable" });
      return jsonUnhandled(ROUTE);
    }
  }

  try {
    await sendNotificationEmail({
      name,
      email,
      company,
      role,
      contracts,
      interested,
      trackingMethod,
      hasTracker: hasTrackerForReview,
      redactedSample: redactedSampleForReview,
      preference,
      pain,
      message,
    });
  } catch (err) {
    console.error("[contact] handler failure", err);
    return jsonUnhandled(ROUTE);
  }

  return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
}
