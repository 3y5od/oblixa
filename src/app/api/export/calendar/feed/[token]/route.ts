import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { createHash } from "node:crypto";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { secureCompareUtf8 } from "@/lib/security/secret-compare";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const FEED_STATUS_HEADER = "x-oblixa-export-status";
const FEED_DIAGNOSTIC_ID_HEADER = "x-oblixa-diagnostic-id";

function calendarFeedFailure(error: string, diagnosticId: string, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      error,
      code: "data_source_failed",
      diagnostic_id: diagnosticId,
      phase: "persist",
    },
    { status }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`calendar-feed-read:${ip}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }

  const admin = await createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenPrefix = token.slice(0, 12);

  const { data: feedRows, error: feedRowsError } = await admin
    .from("calendar_feeds")
    .select("id, organization_id, active, token, token_hash, expires_at, revoked_at")
    .or(`token_prefix.eq.${tokenPrefix},token.eq.${token}`)
    .eq("active", true)
    .is("revoked_at", null)
    .limit(10);
  if (feedRowsError) {
    return calendarFeedFailure("Could not load calendar feed", "calendar_feed_lookup_failed");
  }
  const feed = (feedRows ?? []).find((row) => {
    const expired = !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    if (expired || !row.active || row.revoked_at) return false;
    const hashMatch = !!row.token_hash && secureCompareUtf8(row.token_hash, tokenHash);
    const legacyMatch = !!row.token && secureCompareUtf8(row.token, token);
    return hashMatch || legacyMatch;
  });
  if (!feed) {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: feed.organization_id,
    apiPath: "/api/export/calendar/feed/[token]",
  });
  if (modeGate) return modeGate;

  let degradedDiagnosticId: string | null = null;
  const { error: accessUpdateError } = await admin
    .from("calendar_feeds")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", feed.id);
  if (accessUpdateError) {
    degradedDiagnosticId = "calendar_feed_last_access_update_failed";
  }

  try {
    const body = await buildOrganizationCalendarIcs(admin, feed.organization_id);
    const response = new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
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
