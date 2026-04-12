import { NextResponse } from "next/server";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { createHash, randomBytes } from "node:crypto";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

function createFeedToken(): string {
  return randomBytes(32).toString("hex");
}

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`calendar-feed-create:${ip}`, {
    max: 30,
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
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/export/calendar/feed",
  });
  if (modeGate) return modeGate;

  const { data: existing } = await admin
    .from("calendar_feeds")
    .select("id, token, token_prefix, token_hash, expires_at")
    .eq("organization_id", membership.organization_id)
    .eq("user_id", user.id)
    .eq("active", true)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existing?.token) {
    return NextResponse.json({
      token: existing.token,
      feedPath: `/api/export/calendar/feed/${existing.token}`,
      expiresAt: existing.expires_at,
    });
  }

  const token = createFeedToken();
  const keyPrefix = token.slice(0, 12);
  const keyHash = createHash("sha256").update(token).digest("hex");
  if (!existing) {
    await admin.from("calendar_feeds").insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      token: null,
      token_prefix: keyPrefix,
      token_hash: keyHash,
      active: true,
      expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } else {
    await admin
      .from("calendar_feeds")
      .update({
        token: null,
        token_prefix: keyPrefix,
        token_hash: keyHash,
        active: true,
        revoked_at: null,
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", existing.id);
  }
  return NextResponse.json({
    token,
    feedPath: `/api/export/calendar/feed/${token}`,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
