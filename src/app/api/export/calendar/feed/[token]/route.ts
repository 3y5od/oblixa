import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem, jsonRateLimited } from "@/lib/http/problem";
import { createAdminClient } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { publicTokenHash, publicTokenPrefix, publicTokenStableKey } from "@/lib/security/public-token-key";
import { secureCompareUtf8 } from "@/lib/security/secret-compare";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const FEED_STATUS_HEADER = "x-oblixa-export-status";
const FEED_DIAGNOSTIC_ID_HEADER = "x-oblixa-diagnostic-id";
const ROUTE = "/api/export/calendar/feed/[token]";

function calendarFeedFailure(error: string, diagnosticId: string, status = 500) {
  return jsonProblem(status, {
    error,
    code: "data_source_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
    details: { phase: "persist" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/export/calendar/feed/[token]");
  if (routeParamRejection) return routeParamRejection;
  const tokenHash = publicTokenHash(token);
  const tokenPrefix = publicTokenPrefix(token);
  const tokenKey = publicTokenStableKey(token);
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`calendar-feed-read:${ip}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const tokenRl = await rateLimitCheck(`calendar-feed-read:token-hash:${tokenKey}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!tokenRl.ok) {
    return jsonRateLimited(tokenRl.retryAfterMs, ROUTE);
  }

  const admin = await createAdminClient();

  const { data: feedRows, error: feedRowsError } = await admin
    .from("calendar_feeds")
    .select("id, organization_id, active, token_hash, expires_at, revoked_at")
    .or(`token_prefix.eq.${tokenPrefix},token_hash.eq.${tokenHash}`)
    .limit(10);
  if (feedRowsError) {
    return calendarFeedFailure("Could not load calendar feed", "calendar_feed_lookup_failed");
  }
  const feedCandidate = (feedRows ?? []).find((row) => !!row.token_hash && secureCompareUtf8(row.token_hash, tokenHash));
  if (!feedCandidate) {
    recordPublicTokenMiss({ surface: "calendar_feed", route: ROUTE, tokenKey, ip, reason: "not_found" });
    return jsonNotFound(ROUTE);
  }
  const feed = (() => {
    const row = feedCandidate;
    const expired = !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    if (expired) {
      recordPublicTokenMiss({ surface: "calendar_feed", route: ROUTE, tokenKey, ip, reason: "expired" });
      return null;
    }
    if (!row.active || row.revoked_at) {
      recordPublicTokenMiss({ surface: "calendar_feed", route: ROUTE, tokenKey, ip, reason: "revoked" });
      return null;
    }
    return row;
  })();
  if (!feed) {
    return jsonNotFound(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: feed.organization_id,
    apiPath: "/api/export/calendar/feed/[token]",
  });
  if (modeGate) return modeGate;

  void recordApiRouteAuditEvent(admin, {
    organizationId: feed.organization_id,
    actorUserId: null,
    actorType: "external",
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  let degradedDiagnosticId: string | null = null;
  const { error: accessUpdateError } = await admin
    .from("calendar_feeds")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", feed.id)
    .eq("organization_id", feed.organization_id);
  if (accessUpdateError) {
    degradedDiagnosticId = "calendar_feed_last_access_update_failed";
  }

  try {
    const body = await buildOrganizationCalendarIcs(admin, feed.organization_id);
    const response = new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
    if (degradedDiagnosticId) {
      response.headers.set(FEED_STATUS_HEADER, "degraded");
      response.headers.set(FEED_DIAGNOSTIC_ID_HEADER, degradedDiagnosticId);
    }
    return response;
  } catch {
    return calendarFeedFailure("Could not build calendar export", "calendar_feed_build_failed", 500);
  }
}
