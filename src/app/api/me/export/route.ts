import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { getClientIpFromRequest, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { recordSecurityAuditEvent, recordSecurityAuditEventStrict } from "@/lib/security/audit-write";
import {
  contentDispositionAttachment,
  sanitizeExportFileName,
  sanitizeExportFileNameToken,
} from "@/lib/security/export-filename";
import {
  buildPrivacySafeUserExportPayload,
  isLegalHoldProfile,
} from "@/lib/security/privacy-inventory";

const ROUTE = "/api/me/export";

/**
 * Minimal authenticated self-service export (DSR-oriented JSON bundle).
 * Disable with `OBLIXA_DSR_SELF_EXPORT=0` if operators need to pause exports.
 */
export async function GET(request: Request) {
  if (process.env.OBLIXA_DSR_SELF_EXPORT === "0") {
    return jsonForbidden(ROUTE);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonUnauthorized(ROUTE);
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`dsr-export:${user.id}:${ip}`, RATE_LIMITS.dsrSelfExport);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const admin = await createAdminClient();
  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(400, {
      error: "No organization membership",
      code: "organization_membership_missing",
      diagnostic_id: "self_export_membership_missing",
      route: ROUTE,
    });
  }

  const [{ data: profile }, { data: org }] = await Promise.all([
    admin.from("profiles").select("full_name, legal_hold").eq("id", user.id).maybeSingle(),
    admin
      .from("organizations")
      .select("id, name, mfa_required, created_at")
      .eq("id", membership.organization_id)
      .maybeSingle(),
  ]);

  if (isLegalHoldProfile(profile)) {
    void recordSecurityAuditEvent(admin, {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      action: "security.dsr_self_export_blocked_legal_hold",
      targetType: "user",
      targetId: user.id,
      outcome: "forbidden",
      safeMetadata: {},
    });
    return jsonProblem(403, {
      error: "Export is blocked by an active legal hold",
      code: "legal_hold",
      diagnostic_id: "self_export_legal_hold",
      route: ROUTE,
    });
  }

  const exportedAt = new Date().toISOString();
  const payload = buildPrivacySafeUserExportPayload({
    exportedAt,
    user: { id: user.id, email: user.email },
    profile,
    organization: org,
    membership,
  });

  try {
    await recordSecurityAuditEventStrict(admin, {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      action: "security.dsr_self_export_downloaded",
      targetType: "user",
      targetId: user.id,
      outcome: "success",
      safeMetadata: {},
    });
  } catch {
    return jsonProblem(500, {
      error: "Export audit could not be recorded",
      code: "audit_write_failed",
      diagnostic_id: "self_export_audit_write_failed",
      route: ROUTE,
    });
  }
  const fileName = sanitizeExportFileName(`oblixa-self-export-${sanitizeExportFileNameToken(user.id)}.json`);

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": contentDispositionAttachment(fileName),
      "Cache-Control": "private, no-store",
    },
  });
}
