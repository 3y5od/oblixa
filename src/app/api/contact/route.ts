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
  pain: 600,
  message: 4000,
} as const;

const ALLOWED_INTERESTED = [
  "core",
  "founding_customer",
  "guided_pilot",
  "larger_team",
  "assurance_workflows",
  "custom",
  "dpa",
  "general",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recentSubmissionDigests = new Map<string, number>();

type ContactBody = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  role?: unknown;
  contracts?: unknown;
  interested?: unknown;
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
      core: "Core (self-serve trial)",
      founding_customer: "Founding Customer offer",
      guided_pilot: "Guided pilot",
      larger_team: "Larger-team workflows",
      assurance_workflows: "Assurance workflows",
      custom: "Custom workflows",
      dpa: "Data Processing Addendum (DPA)",
    }[payload.interested] ?? payload.interested;

  const rows: Array<[string, string]> = [
    ["Name", payload.name],
    ["Work email", payload.email],
    ["Company", payload.company],
    ["Role", payload.role],
    ["Contracts", payload.contracts],
    ["Interested in", interestedLabel],
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
    await safeFetch(RESEND_EMAILS_URL, {
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
  const pain = trimOrEmpty(body.pain, FIELD_MAX.pain);
  const message = trimOrEmpty(body.message, FIELD_MAX.message);

  if (!name || !email || !company || !role || !contracts || !interested) {
    return jsonBadRequest(ROUTE, { reason: "missing_required" });
  }
  if (!EMAIL_RE.test(email)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_email" });
  }
  if (!(ALLOWED_INTERESTED as readonly string[]).includes(interested)) {
    return jsonBadRequest(ROUTE, { reason: "invalid_interested" });
  }

  if (
    hasDuplicateContactSubmission({
      name,
      email,
      company,
      role,
      contracts,
      interested,
      pain,
      message,
    })
  ) {
    return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    await sendNotificationEmail({
      name,
      email,
      company,
      role,
      contracts,
      interested,
      pain,
      message,
    });
  } catch (err) {
    console.error("[contact] handler failure", err);
    return jsonUnhandled(ROUTE);
  }

  return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
}
