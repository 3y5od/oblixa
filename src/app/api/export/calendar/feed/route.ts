import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { createHash, randomBytes } from "node:crypto";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/export/calendar/feed";

function createFeedToken(): string {
  return randomBytes(32).toString("hex");
}

function calendarFeedFailure(error: string, diagnosticId: string, status = 500) {
  return jsonProblem(status, {
    error,
    code: "data_source_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
    details: { phase: "persist" },
  });
}

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`calendar-feed-create:${ip}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized(ROUTE);

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(400, {
      error: "No organization",
      code: "organization_not_found",
      diagnostic_id: "calendar_feed_organization_not_found",
      route: ROUTE,
    });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/export/calendar/feed",
  });
  if (modeGate) return modeGate;

  void recordApiRouteAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: existingError } = await admin
    .from("calendar_feeds")
    .select("id, token_prefix, token_hash, expires_at")
    .eq("organization_id", membership.organization_id)
    .eq("user_id", user.id)
    .eq("active", true)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existingError) {
    return calendarFeedFailure("Could not load calendar feed", "calendar_feed_lookup_failed");
  }

  const token = createFeedToken();
  const keyPrefix = token.slice(0, 12);
  const keyHash = createHash("sha256").update(token).digest("hex");
  if (!existing) {
    const { error: insertError } = await admin.from("calendar_feeds").insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      token: null,
      token_prefix: keyPrefix,
      token_hash: keyHash,
      active: true,
      expires_at: expiresAt,
    });
    if (insertError) {
      return calendarFeedFailure("Could not create calendar feed", "calendar_feed_create_failed");
    }
  } else {
    const { error: updateError } = await admin
      .from("calendar_feeds")
      .update({
        token: null,
        token_prefix: keyPrefix,
        token_hash: keyHash,
        active: true,
        revoked_at: null,
        expires_at: expiresAt,
      })
      .eq("id", existing.id);
    if (updateError) {
      return calendarFeedFailure("Could not rotate calendar feed", "calendar_feed_update_failed");
    }
  }
  return NextResponse.json({
    token,
    feedPath: `/api/export/calendar/feed/${token}`,
    expiresAt,
  });
}
