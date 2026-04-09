import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { secureCompareUtf8 } from "@/lib/security/secret-compare";

function parseIsoDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`events:${ip}`, RATE_LIMITS.eventsRead);
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
  let organizationId: string | null = null;
  const apiKey = request.headers.get("x-api-key")?.trim() ?? "";
  if (apiKey) {
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyPrefix = apiKey.slice(0, 12);
    const { data: keyRow } = await admin
      .from("integration_api_keys")
      .select("id, organization_id, active, key_hash, key_prefix, scopes, expires_at, revoked_at")
      .eq("key_prefix", keyPrefix)
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();
    const now = Date.now();
    const expired =
      !!keyRow?.expires_at &&
      new Date(keyRow.expires_at).getTime() <= now;
    const hasScope = (keyRow?.scopes ?? []).includes("events:read");
    if (
      !keyRow ||
      expired ||
      !hasScope ||
      !secureCompareUtf8(keyRow.key_hash, keyHash)
    ) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    organizationId = keyRow.organization_id;
    await admin
      .from("integration_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }
    organizationId = membership.organization_id;
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "50")));
  const since = url.searchParams.get("since");
  const parsedSince = since ? parseIsoDate(since) : null;
  if (since && !parsedSince) {
    return NextResponse.json({ error: "Invalid since parameter" }, { status: 400 });
  }

  let query = admin
    .from("audit_events")
    .select("id, contract_id, action, details, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (parsedSince) {
    query = query.gte("created_at", parsedSince);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    events: data ?? [],
    count: data?.length ?? 0,
  });
}
