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
import { createAdminClient } from "@/lib/supabase/server";
import { insertAccessRequestRecord } from "@/lib/access-review";
import {
  asContactRecord,
  hasDuplicateContactSubmission,
  isContactHoneypotFilled,
  normalizeContactPayload,
  sendNotificationEmail,
  validateContactPayload,
  type ContactBody,
  type ContactNotificationResult,
} from "@/lib/contact-route-helpers";

const ROUTE = "/api/contact";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Rate limit per trusted client IP.
  const ip = await getTrustedClientIpFromRequest(request);
  const rl = await rateLimitCheck(`${ROUTE}:${ip}`, RATE_LIMITS.marketingContact);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const parsed = await readJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON);
  if (!parsed.ok) return parsed.response;

  const body = asContactRecord(parsed.body) as ContactBody | null;
  if (!body) {
    return jsonBadRequest(ROUTE, { reason: "missing_body" });
  }

  if (isContactHoneypotFilled(body)) {
    return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const payload = normalizeContactPayload(body);
  const validationReason = validateContactPayload(payload);
  if (validationReason) return jsonBadRequest(ROUTE, { reason: validationReason });

  const isAccessIntent = payload.interested === "request_access" || payload.interested === "early_access";
  const isShortWindowDuplicate = hasDuplicateContactSubmission(payload);

  if (isShortWindowDuplicate && !isAccessIntent) {
    return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
  }

  let accessRequestPersisted = !isAccessIntent;
  if (isAccessIntent) {
    try {
      const admin = await createAdminClient();
      const inserted = await insertAccessRequestRecord(admin, {
        normalizedEmail: payload.email,
        requesterName: payload.name,
        companyName: payload.company,
        requesterRole: payload.role,
        approximateContractCount: payload.contracts,
        currentTrackingMethod: payload.trackingMethod,
        hasTracker: payload.hasTracker,
        redactedSampleAvailable: payload.redactedSample,
        followUpPreference: payload.preference,
        accountableOwner: payload.accountableOwner,
        procurementBeforeUpload: payload.procurementBeforeUpload,
        smallFirstSet: payload.smallFirstSet,
        painSummary: payload.pain,
        message: payload.message,
        source: "request_access",
      });
      if (!inserted.ok) {
        console.error("[contact] access request persistence failed", { reason: inserted.error });
      } else {
        accessRequestPersisted = true;
      }
    } catch {
      console.error("[contact] access request persistence failed", { reason: "unavailable" });
    }
  }

  let notification: ContactNotificationResult;
  try {
    notification = await sendNotificationEmail(payload);
  } catch (err) {
    console.error("[contact] handler failure", err);
    return jsonUnhandled(ROUTE);
  }

  if (isAccessIntent && !accessRequestPersisted && !notification.delivered) {
    return jsonUnhandled(ROUTE);
  }

  return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE_HEADERS });
}
