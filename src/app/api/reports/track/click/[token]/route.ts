import { NextResponse } from "next/server";
import { jsonRateLimited } from "@/lib/http/problem";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { getCanonicalAppBaseUrlFromEnv } from "@/lib/app-url";
import { getTrustedPublicOriginFromRequest } from "@/lib/security/trusted-forwarded";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import {
  publicTokenHash,
  publicTokenHashMatches,
  publicTokenPrefix,
  publicTokenStableKey,
} from "@/lib/security/public-token-key";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const TRACKING_STATUS_HEADER = "x-oblixa-tracking-status";
const TRACKING_DIAGNOSTIC_ID_HEADER = "x-oblixa-diagnostic-id";
const ROUTE = "/api/reports/track/click/[token]";

function safeFallback(request: Request): string {
  return `${getTrustedPublicOriginFromRequest(request)}/dashboard`;
}

function getSafeTarget(request: Request): string {
  const reqUrl = new URL(request.url);
  const requestOrigin = getTrustedPublicOriginFromRequest(request);
  const targetRaw = reqUrl.searchParams.get("target") ?? "";
  if (!targetRaw) return safeFallback(request);
  try {
    // Only allow same-origin redirects. Relative paths are always resolved
    // against the current request origin and kept on-site.
    if (targetRaw.startsWith("/")) {
      if (targetRaw.startsWith("//")) return safeFallback(request);
      return new URL(targetRaw, requestOrigin).toString();
    }

    const target = new URL(targetRaw);
    if (!["http:", "https:"].includes(target.protocol)) {
      return safeFallback(request);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const allowedOrigin = appUrl
      ? new URL(appUrl).origin
      : getCanonicalAppBaseUrlFromEnv() ?? requestOrigin;
    if (target.origin !== allowedOrigin) return safeFallback(request);
    return target.toString();
  } catch {
    return safeFallback(request);
  }
}

export function normalizeClickedTargetForStorage(target: string): string {
  return normalizeClickedTargetWithRedaction(target).storedUrl;
}

export function normalizeClickedTargetWithRedaction(target: string): {
  storedUrl: string;
  redacted_query_keys: string[];
} {
  try {
    const url = new URL(target);
    const redactedQueryKeys = Array.from(new Set(Array.from(url.searchParams.keys()))).sort();
    url.search = "";
    url.hash = "";
    return {
      storedUrl: url.toString().slice(0, 2000),
      redacted_query_keys: redactedQueryKeys,
    };
  } catch {
    return {
      storedUrl: "invalid-target",
      redacted_query_keys: [],
    };
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`report-track-click:${ip}`, RATE_LIMITS.reportTrackClick);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const { token } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/reports/track/click/[token]");
  if (routeParamRejection) return routeParamRejection;
  const target = getSafeTarget(request);
  let diagnosticId: string | null = null;
  if (token && token.length >= 8) {
    const tokenHash = publicTokenHash(token);
    const tokenPrefix = publicTokenPrefix(token);
    const tokenKey = publicTokenStableKey(token);
    const tokenRl = await rateLimitCheck(`report-track-click:token-hash:${tokenKey}`, RATE_LIMITS.reportTrackClick);
    if (!tokenRl.ok) {
      return jsonRateLimited(tokenRl.retryAfterMs, ROUTE);
    }
    try {
      const admin = await createAdminClient();
      const nowIso = new Date().toISOString();
      const rowResult = await admin
        .from("report_run_recipients")
        .select("organization_id, click_count, engagement_token_hash, engagement_revoked_at")
        .or(`engagement_token_prefix.eq.${tokenPrefix},engagement_token_hash.eq.${tokenHash}`)
        .limit(10);
      if (rowResult.error) {
        diagnosticId = "report_track_click_read_failed";
      } else {
        const row = (rowResult.data ?? []).find((candidate) =>
          publicTokenHashMatches(candidate.engagement_token_hash, tokenHash)
        );
        if (!row) {
          recordPublicTokenMiss({ surface: "report_click", route: ROUTE, tokenKey, ip, reason: "not_found" });
        } else if (row.engagement_revoked_at) {
          recordPublicTokenMiss({ surface: "report_click", route: ROUTE, tokenKey, ip, reason: "revoked" });
        } else {
          const updateResult = await admin
            .from("report_run_recipients")
            .update({
              clicked_at: nowIso,
              click_count: Math.max(0, Number(row.click_count ?? 0)) + 1,
              last_clicked_url: normalizeClickedTargetForStorage(target),
              delivery_status: "clicked",
            })
            .eq("engagement_token_hash", tokenHash);
          if (updateResult.error) {
            diagnosticId = "report_track_click_write_failed";
          } else if (row.organization_id) {
            void recordApiRouteAuditEvent(admin, {
              organizationId: String(row.organization_id),
              actorUserId: null,
              actorType: "external",
              route: ROUTE,
              method: "GET",
              action: "api.mutation_authorized",
            }).catch(() => undefined);
          }
        }
      }
    } catch {
      diagnosticId = "report_track_click_admin_unavailable";
    }
  }
  const res = NextResponse.redirect(target, { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  if (diagnosticId) {
    res.headers.set(TRACKING_STATUS_HEADER, "degraded");
    res.headers.set(TRACKING_DIAGNOSTIC_ID_HEADER, diagnosticId);
  }
  return res;
}
