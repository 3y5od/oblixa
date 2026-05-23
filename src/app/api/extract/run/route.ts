import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited } from "@/lib/http/problem";
import { BODY_LIMIT_LARGE_JSON, readJsonBodyLimitedWithRaw } from "@/lib/security/read-json-body-limited";
import { runExtractionPipeline } from "@/lib/extraction/run-pipeline";
import {
  getClientIpFromRequest,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { enforceIdempotency } from "@/lib/idempotency";
import { requireBearerSecret } from "@/lib/security/api-guards";
import { verifyInternalHmacRequest } from "@/lib/security/internal-hmac";
import { isStrictSecretRotationEnv } from "@/lib/security/rotating-secret";
import { isUuid } from "@/lib/security/validation";
import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";
import { createAdminClient } from "@/lib/supabase/server";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireTenantAiProcessingEnabled } from "@/lib/security/ai-tenant-gate";

const ROUTE = "/api/extract/run";

/**
 * Isolated invocation for extraction (separate from POST /api/extract request lifecycle).
 * `maxDuration` should match the host’s serverless cap; large PDFs + OpenAI may need
 * this worker on a separate origin or queue if the platform times out earlier.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(
    `extract-worker:${ip}`,
    RATE_LIMITS.extractWorker
  );
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const _lim = await readJsonBodyLimitedWithRaw(request, BODY_LIMIT_LARGE_JSON);
  if (!_lim.ok) return _lim.response;
  const body = _lim.body;

  const internalHmacSecret = process.env.OBLIXA_INTERNAL_HMAC_SECRET?.trim();
  if (internalHmacSecret) {
    const signed = verifyInternalHmacRequest(request, {
      body: _lim.rawBody,
      currentSecret: internalHmacSecret,
      previousSecret: process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET,
      previousSecretExpiresAt: process.env.OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT,
    });
    if (!signed.ok) {
      return jsonProblem(401, {
        error: "Unauthorized",
        code: "internal_signature_invalid",
        diagnostic_id: "extract_worker_internal_signature_invalid",
        route: ROUTE,
        reason: signed.reason,
      });
    }
  } else if (isStrictSecretRotationEnv()) {
    return jsonProblem(503, {
      error: "Worker not configured",
      code: "worker_not_configured",
      diagnostic_id: "extract_worker_hmac_not_configured",
      route: ROUTE,
    });
  } else {
    const auth = requireBearerSecret(request, "EXTRACTION_WORKER_SECRET", {
      missingSecretResponse: () =>
        jsonProblem(503, {
          error: "Worker not configured",
          code: "worker_not_configured",
          diagnostic_id: "extract_worker_not_configured",
          route: ROUTE,
        }),
    });
    if (auth) return auth;
  }

  if (!body || typeof body !== "object") {
    return jsonProblem(400, {
      error: "Invalid body",
      code: "invalid_body",
      diagnostic_id: "extract_worker_invalid_body",
      route: ROUTE,
    });
  }

  const contractId = String((body as { contractId?: unknown }).contractId ?? "").trim();
  const userId = String((body as { userId?: unknown }).userId ?? "").trim();
  const organizationId = String(
    (body as { organizationId?: unknown }).organizationId ?? ""
  ).trim();

  if (!contractId || !userId || !organizationId) {
    return jsonProblem(400, {
      error: "contractId, userId, and organizationId required",
      code: "required_ids_missing",
      diagnostic_id: "extract_worker_required_ids_missing",
      route: ROUTE,
    });
  }

  if (!isUuid(contractId) || !isUuid(userId) || !isUuid(organizationId)) {
    return jsonProblem(400, {
      error: "Invalid ids",
      code: "invalid_ids",
      diagnostic_id: "extract_worker_invalid_ids",
      route: ROUTE,
    });
  }
  const auditScope = { organization_id: organizationId };

  const duplicate = await enforceIdempotency(request, {
    scope: "extract-worker",
    actorKey: `${auditScope.organization_id}:${contractId}`,
  });
  if (duplicate) return duplicate;

  const admin = await createAdminClient();
  const aiGate = await requireTenantAiProcessingEnabled(admin, auditScope.organization_id);
  if (!aiGate.ok) {
    return jsonProblem(403, {
      error: "AI processing is disabled for this organization",
      code: "tenant_ai_processing_disabled",
      diagnostic_id: "extract_worker_tenant_ai_disabled",
      route: ROUTE,
    });
  }
  void recordApiMutationAuditEvent(admin, {
    organizationId: auditScope.organization_id,
    actorUserId: userId,
    actorType: "system",
    route: ROUTE,
    method: "POST",
  }).catch(() => undefined);

  try {
    await runExtractionPipeline({
      admin,
      contractId,
      userId,
      organizationId: auditScope.organization_id,
    });
  } catch (err) {
    console.error("[api/extract/run] pipeline error:", formatUnknownForServerLog(err));
    return jsonProblem(500, {
      error: "Pipeline failed",
      code: "pipeline_failed",
      diagnostic_id: "extract_worker_pipeline_failed",
      route: ROUTE,
    });
  }

  return NextResponse.json({ ok: true });
}
