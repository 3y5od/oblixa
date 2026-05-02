import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { isStepUpCookieValidForUser } from "@/lib/security/step-up-cookie";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { getClientIpFromRequest, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Account deletion request hook (DSR). Product deletion orchestration is not automated here;
 * this records an audit event when the operator flag and step-up cookie are satisfied.
 */
export async function DELETE(request: Request) {
  if (process.env.OBLIXA_DSR_ACCOUNT_DELETE !== "1") {
    return NextResponse.json({ error: "Account deletion API is not enabled" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const jar = await cookies();
  if (!isStepUpCookieValidForUser(jar, user.id)) {
    return NextResponse.json({ error: "Step-up required" }, { status: 403 });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`dsr-delete:${user.id}:${ip}`, RATE_LIMITS.stepUpPassword);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const admin = await createAdminClient();
  const membership = await getDeterministicMembership(admin, user.id);
  if (membership) {
    const { data: profile } = await admin
      .from("profiles")
      .select("legal_hold")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && (profile as { legal_hold?: boolean }).legal_hold === true) {
      void recordSecurityAuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "security.dsr_account_delete_blocked_legal_hold",
        targetType: "user",
        targetId: user.id,
        outcome: "forbidden",
        safeMetadata: {},
      });
      return NextResponse.json({ error: "Deletion is blocked by an active legal hold" }, { status: 403 });
    }

    void recordSecurityAuditEvent(admin, {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      action: "security.dsr_account_delete_requested",
      targetType: "user",
      targetId: user.id,
      outcome: "success",
      safeMetadata: { note: "deletion_orchestration_pending" },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      status: "accepted",
      detail:
        "Deletion is recorded for operator follow-up; automated purge is not executed in this build.",
    },
    { status: 202 }
  );
}
