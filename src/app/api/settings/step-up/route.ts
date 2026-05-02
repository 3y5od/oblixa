import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createClient,
  createAdminClient,
  getDeterministicMembership,
} from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/env/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { getClientIpFromRequest, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { mintStepUpCookieValue, STEP_UP_COOKIE_NAME } from "@/lib/security/step-up-cookie";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { safeFetch } from "@/lib/security/safe-fetch";

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`step-up:${ip}`, RATE_LIMITS.stepUpPassword);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = await parseJsonBodyWithLimit(request, (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return { password: typeof o.password === "string" ? o.password : "" };
  });
  if (!parsed.ok) return parsed.response;
  const password = parsed.data.password;
  if (!password || password.length > 256) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const t0 = Date.now();
  const { url, anonKey } = getSupabasePublicEnv();
  let res: Response;
  try {
    res = await safeFetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: user.email, password }),
      timeoutMs: 12_000,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach auth service" }, { status: 502 });
  }

  const ok = res.ok;
  const wait = Math.max(0, 220 - (Date.now() - t0));
  await new Promise((r) => setTimeout(r, wait));

  if (!ok) {
    return NextResponse.json({ error: "Could not verify password" }, { status: 401 });
  }

  const token = mintStepUpCookieValue(user.id);
  if (!token) {
    return NextResponse.json({ error: "Step-up is not configured (missing secret)" }, { status: 500 });
  }

  const jar = await cookies();
  jar.set(STEP_UP_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  try {
    const admin = await createAdminClient();
    const membership = await getDeterministicMembership(admin, user.id);
    if (membership) {
      void recordSecurityAuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "security.step_up_password_verified",
        targetType: "user",
        targetId: user.id,
        outcome: "success",
        safeMetadata: {},
      });
    }
  } catch {
    // audit is best-effort
  }

  return NextResponse.json({ ok: true });
}
