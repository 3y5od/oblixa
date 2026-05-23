import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
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
import { enforceIdempotency } from "@/lib/idempotency";

const ROUTE = "/api/settings/step-up";

export const maxDuration = 30;

async function recordStepUpPasswordAudit(
  userId: string,
  outcome: "success" | "failure" | "server_error",
  safeMetadata: Record<string, string | boolean | number | null> = {}
) {
  try {
    const admin = await createAdminClient();
    const membership = await getDeterministicMembership(admin, userId);
    if (membership) {
      void recordSecurityAuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: userId,
        action: "security.step_up_password_verified",
        targetType: "user",
        targetId: userId,
        outcome,
        safeMetadata,
      });
    }
  } catch {
    // audit is best-effort
  }
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`step-up:${ip}`, RATE_LIMITS.stepUpPassword);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return jsonUnauthorized(ROUTE);
  }

  const userRl = await rateLimitCheck(`step-up:${user.id}:${ip}`, RATE_LIMITS.stepUpPassword);
  if (!userRl.ok) {
    return jsonRateLimited(userRl.retryAfterMs, ROUTE);
  }

  const duplicate = await enforceIdempotency(request, {
    scope: "api.settings.step-up",
    actorKey: `user:${user.id}`,
  });
  if (duplicate) return duplicate;

  const parsed = await parseJsonBodyWithLimit(request, (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return { password: typeof o.password === "string" ? o.password : "" };
  });
  if (!parsed.ok) return parsed.response;
  const password = parsed.data.password;
  if (!password || password.length > 256) {
    return jsonProblem(400, {
      error: "Invalid request",
      code: "invalid_request",
      diagnostic_id: "step_up_invalid_request",
      route: ROUTE,
    });
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
    return jsonProblem(502, {
      error: "Could not reach auth service",
      code: "auth_service_unreachable",
      diagnostic_id: "step_up_auth_service_unreachable",
      route: ROUTE,
    });
  }

  const ok = res.ok;
  const wait = Math.max(0, 220 - (Date.now() - t0));
  await new Promise((r) => setTimeout(r, wait));

  if (!ok) {
    await recordStepUpPasswordAudit(user.id, "failure", {
      reason: "password_verification_failed",
    });
    return jsonProblem(401, {
      error: "Could not verify password",
      code: "password_verification_failed",
      diagnostic_id: "step_up_password_verification_failed",
      route: ROUTE,
    });
  }

  const token = mintStepUpCookieValue(user.id);
  if (!token) {
    await recordStepUpPasswordAudit(user.id, "server_error", {
      reason: "missing_step_up_secret",
    });
    return jsonProblem(500, {
      error: "Step-up is not configured (missing secret)",
      code: "step_up_not_configured",
      diagnostic_id: "step_up_missing_secret",
      route: ROUTE,
    });
  }

  const jar = await cookies();
  jar.set(STEP_UP_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  await recordStepUpPasswordAudit(user.id, "success");

  return NextResponse.json({ ok: true });
}
