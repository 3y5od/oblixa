import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import {
  publicTokenHash,
  publicTokenHashMatches,
  publicTokenPrefix,
  publicTokenStableKey,
} from "@/lib/security/public-token-key";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const PIXEL_GIF_BASE64 = "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";
const TRACKING_STATUS_HEADER = "x-oblixa-tracking-status";
const TRACKING_DIAGNOSTIC_ID_HEADER = "x-oblixa-diagnostic-id";
const ROUTE = "/api/reports/track/open/[token]";

function pixelResponse(status: number, retryAfterSec?: number, diagnosticId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store",
  };
  if (retryAfterSec != null) {
    headers["Retry-After"] = String(retryAfterSec);
  }
  if (diagnosticId) {
    headers[TRACKING_STATUS_HEADER] = "degraded";
    headers[TRACKING_DIAGNOSTIC_ID_HEADER] = diagnosticId;
  }
  return new Response(Buffer.from(PIXEL_GIF_BASE64, "base64"), { status, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`report-track-open:${ip}`, RATE_LIMITS.reportTrackOpen);
  if (!rl.ok) {
    return pixelResponse(
      429,
      Math.max(1, Math.ceil(rl.retryAfterMs / 1000))
    );
  }
  const { token } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/reports/track/open/[token]");
  if (routeParamRejection) return routeParamRejection;
  if (!token || token.length < 8) {
    return pixelResponse(200);
  }
  const tokenHash = publicTokenHash(token);
  const tokenPrefix = publicTokenPrefix(token);
  const tokenKey = publicTokenStableKey(token);
  const tokenRl = await rateLimitCheck(`report-track-open:token-hash:${tokenKey}`, RATE_LIMITS.reportTrackOpen);
  if (!tokenRl.ok) {
    return pixelResponse(429, Math.max(1, Math.ceil(tokenRl.retryAfterMs / 1000)));
  }
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  try {
    admin = await createAdminClient();
  } catch {
    return pixelResponse(200, undefined, "report_track_open_admin_unavailable");
  }
  const rowResult = await admin
    .from("report_run_recipients")
    .select("organization_id, engagement_token_hash, engagement_revoked_at")
    .or(`engagement_token_prefix.eq.${tokenPrefix},engagement_token_hash.eq.${tokenHash}`)
    .limit(10);
  if (rowResult.error) {
    return pixelResponse(200, undefined, "report_track_open_read_failed");
  }
  const row = (rowResult.data ?? []).find((candidate) =>
    publicTokenHashMatches(candidate.engagement_token_hash, tokenHash)
  );
  if (!row) {
    recordPublicTokenMiss({ surface: "report_open", route: ROUTE, tokenKey, ip, reason: "not_found" });
    return pixelResponse(200);
  }
  if (row.engagement_revoked_at) {
    recordPublicTokenMiss({ surface: "report_open", route: ROUTE, tokenKey, ip, reason: "revoked" });
    return pixelResponse(200);
  }
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("report_run_recipients")
    .update({
      opened_at: nowIso,
      delivery_status: "opened",
    })
    .eq("engagement_token_hash", tokenHash)
    .is("opened_at", null);
  if (error) {
    return pixelResponse(200, undefined, "report_track_open_write_failed");
  }
  if (row.organization_id) {
    void recordApiRouteAuditEvent(admin, {
      organizationId: String(row.organization_id),
      actorUserId: null,
      actorType: "external",
      route: ROUTE,
      method: "GET",
      action: "api.mutation_authorized",
    }).catch(() => undefined);
  }

  return pixelResponse(200);
}
