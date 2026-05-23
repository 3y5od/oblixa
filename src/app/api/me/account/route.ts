import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { recordSecurityAuditEvent, recordSecurityAuditEventStrict } from "@/lib/security/audit-write";
import { getClientIpFromRequest, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { PRIVACY_SAFE_RECORD_INVENTORY, isLegalHoldProfile } from "@/lib/security/privacy-inventory";

const ROUTE = "/api/me/account";

/**
 * Account deletion request hook (DSR). Product deletion orchestration is not automated here;
 * this records an audit event when the operator flag and sensitive-action proof are satisfied.
 */
export async function DELETE(request: Request) {
  if (process.env.OBLIXA_DSR_ACCOUNT_DELETE !== "1") {
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
  const rl = await rateLimitCheck(`dsr-delete:${user.id}:${ip}`, RATE_LIMITS.stepUpPassword);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const admin = await createAdminClient();
  const membership = await getDeterministicMembership(admin, user.id);

  const duplicate = await enforceIdempotency(request, {
    scope: "account.delete.request",
    actorKey: user.id,
  });
  if (duplicate) return duplicate;

  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    if (membership) {
      void recordSecurityAuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "security.dsr_account_delete_requested",
        targetType: "user",
        targetId: user.id,
        outcome: "forbidden",
        safeMetadata: { reason: "sensitive_action_proof_required" },
      }).catch(() => undefined);
    }
    return jsonProblem(403, {
      error: "Step-up required",
      code: "step_up_required",
      diagnostic_id: "account_delete_step_up_required",
      route: ROUTE,
    });
  }

  if (membership) {
    const { data: profile } = await admin
      .from("profiles")
      .select("legal_hold")
      .eq("id", user.id)
      .maybeSingle();

    if (isLegalHoldProfile(profile)) {
      void recordSecurityAuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "security.dsr_account_delete_blocked_legal_hold",
        targetType: "user",
        targetId: user.id,
        outcome: "forbidden",
        safeMetadata: {},
      }).catch(() => undefined);
      return jsonProblem(403, {
        error: "Deletion is blocked by an active legal hold",
        code: "legal_hold",
        diagnostic_id: "account_delete_legal_hold",
        route: ROUTE,
      });
    }

    try {
      await recordSecurityAuditEventStrict(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "security.dsr_account_delete_requested",
        targetType: "user",
        targetId: user.id,
        outcome: "success",
        safeMetadata: {
          note: "deletion_orchestration_pending",
          inventory_count: PRIVACY_SAFE_RECORD_INVENTORY.length,
        },
      });
    } catch {
      return jsonProblem(500, {
        error: "Deletion audit could not be recorded",
        code: "audit_write_failed",
        diagnostic_id: "account_delete_audit_write_failed",
        route: ROUTE,
      });
    }
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
