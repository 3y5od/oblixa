import { NextResponse } from "next/server";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { getClientIpFromRequest, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";

/**
 * Minimal authenticated self-service export (DSR-oriented JSON bundle).
 * Disable with `OBLIXA_DSR_SELF_EXPORT=0` if operators need to pause exports.
 */
export async function GET(request: Request) {
  if (process.env.OBLIXA_DSR_SELF_EXPORT === "0") {
    return NextResponse.json({ error: "Self-service export is disabled" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`dsr-export:${user.id}:${ip}`, RATE_LIMITS.dsrSelfExport);
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
  if (!membership) {
    return NextResponse.json({ error: "No organization membership" }, { status: 400 });
  }

  const [{ data: profile }, { data: org }] = await Promise.all([
    admin.from("profiles").select("full_name, legal_hold").eq("id", user.id).maybeSingle(),
    admin
      .from("organizations")
      .select("id, name, mfa_required, created_at")
      .eq("id", membership.organization_id)
      .maybeSingle(),
  ]);

  if (profile && (profile as { legal_hold?: boolean }).legal_hold === true) {
    void recordSecurityAuditEvent(admin, {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      action: "security.dsr_self_export_blocked_legal_hold",
      targetType: "user",
      targetId: user.id,
      outcome: "forbidden",
      safeMetadata: {},
    });
    return NextResponse.json({ error: "Export is blocked by an active legal hold" }, { status: 403 });
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    schema_version: 1,
    user: { id: user.id, email: user.email },
    profile: profile ?? null,
    organization: org ?? null,
    membership: { organization_id: membership.organization_id, role: membership.role },
  };

  void recordSecurityAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    action: "security.dsr_self_export_downloaded",
    targetType: "user",
    targetId: user.id,
    outcome: "success",
    safeMetadata: {},
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="oblixa-self-export-${user.id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
