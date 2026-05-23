import { after } from "next/server";
import { jsonForbidden, jsonNotFound, jsonOk, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { BODY_LIMIT_LARGE_JSON, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveExtractionWorkerOrigin } from "@/lib/app-url";
import { runExtractionPipeline } from "@/lib/extraction/run-pipeline";
import { finishExtractionJob } from "@/lib/extraction-job";
import { fetchWithRetry } from "@/lib/extraction/retry";
import {
  captureServerException,
  captureServerMessage,
} from "@/lib/observability/sentry";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import { startExtractionJob } from "@/lib/extraction-job";
import { isUuid } from "@/lib/security/validation";
import {
  getClientIpFromRequest,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { jsonContentTypeRejection } from "@/lib/security/json-content-type";
import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { isKillExtraction, killSwitchJsonResponse } from "@/lib/security/kill-switches";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { signInternalRequest } from "@/lib/security/internal-hmac";
import { requireTenantAiProcessingEnabled } from "@/lib/security/ai-tenant-gate";

const ROUTE = "/api/extract";

/** Large PDFs + OpenAI can exceed default serverless limits on some hosts */
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ip = getClientIpFromRequest(request);
  const rateKey = user ? `extract:${user.id}:${ip}` : `extract:anon:${ip}`;
  const rl = await rateLimitCheck(rateKey, RATE_LIMITS.extract);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  if (!user) {
    return jsonUnauthorized(ROUTE);
  }

  const ctReject = jsonContentTypeRejection(request);
  if (ctReject) {
    return jsonProblem(ctReject.status, {
      error: "Unsupported media type",
      code: "unsupported_media_type",
      diagnostic_id: "extract_unsupported_media_type",
      route: ROUTE,
      details: ctReject.details,
    });
  }
  if (!secFetchSiteAllowsSensitiveMutation(request)) {
    return jsonProblem(403, {
      error: "Cross-site request rejected",
      code: "cross_site_request_rejected",
      diagnostic_id: "extract_cross_site_rejected",
      route: ROUTE,
    });
  }

  if (isKillExtraction()) {
    return killSwitchJsonResponse("extraction");
  }

  const _limBody = await readJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON);
  if (!_limBody.ok) return _limBody.response;
  const body = _limBody.body;

  const rawId =
    body !== null &&
    typeof body === "object" &&
    "contractId" in body &&
    (body as { contractId: unknown }).contractId != null
      ? String((body as { contractId: unknown }).contractId).trim()
      : "";

  if (!rawId) {
    return jsonProblem(400, {
      error: "contractId required",
      code: "contract_id_required",
      diagnostic_id: "extract_contract_id_required",
      route: ROUTE,
    });
  }

  if (!isUuid(rawId)) {
    return jsonProblem(400, {
      error: "Invalid contractId",
      code: "invalid_contract_id",
      diagnostic_id: "extract_contract_id_invalid",
      route: ROUTE,
    });
  }

  const contractId = rawId;
  const admin = await createAdminClient();

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);
  if (membershipError) {
    return jsonProblem(500, {
      error: "Could not verify organization access",
      code: "organization_access_check_failed",
      diagnostic_id: "extract_org_access_check_failed",
      route: ROUTE,
    });
  }
  const orgIds = [...new Set((memberships ?? []).map((m) => String(m.organization_id)).filter(Boolean))];
  if (orgIds.length === 0) {
    return jsonForbidden(ROUTE);
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .in("organization_id", orgIds)
    .single();

  if (!contract) {
    return jsonNotFound(ROUTE);
  }

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!role) {
    return jsonForbidden(ROUTE);
  }
  if (!canEditContracts(role)) {
    return jsonProblem(403, {
      error: "Viewers cannot run extraction",
      code: "insufficient_role",
      diagnostic_id: "extract_viewer_forbidden",
      route: ROUTE,
    });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: contract.organization_id,
    role,
    apiPath: "/api/extract",
  });
  if (modeGate) return modeGate;
  // §4.4 — billing gate for extraction only; unrelated to product surface mode.
  if (
    isPlanEnforcementEnabled() &&
    !(await orgHasActivePlan(admin, contract.organization_id))
  ) {
    return jsonProblem(402, {
      error: "An active subscription is required",
      code: "subscription_required",
      diagnostic_id: "extract_subscription_required",
      route: ROUTE,
    });
  }
  const aiGate = await requireTenantAiProcessingEnabled(admin, contract.organization_id);
  if (!aiGate.ok) {
    return jsonProblem(403, {
      error: "AI processing is disabled for this organization",
      code: "tenant_ai_processing_disabled",
      diagnostic_id: "extract_tenant_ai_disabled",
      route: ROUTE,
    });
  }

  void recordApiMutationAuditEvent(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    route: ROUTE,
    method: "POST",
  }).catch(() => undefined);

  const jobStart = await startExtractionJob(
    admin,
    contractId,
    contract.organization_id
  );
  if (!jobStart.ok) {
    // Idempotent: duplicate POSTs (double-click, slow network) race here; the first
    // request already set processing + scheduled work — treat as accepted, not an error.
    if (jobStart.status === 409) {
      return jsonOk(
        {
          accepted: true,
          async: true,
          message: "Extraction already in progress",
        },
        { status: 202 }
      );
    }
    return jsonProblem(jobStart.status, {
      error: jobStart.error,
      code: "extraction_job_start_failed",
      diagnostic_id: "extract_job_start_failed",
      route: ROUTE,
    });
  }

  const orgId = contract.organization_id;
  const uid = user.id;
  const workerSecret = process.env.EXTRACTION_WORKER_SECRET?.trim();
  const internalHmacSecret = process.env.OBLIXA_INTERNAL_HMAC_SECRET?.trim();
  const workerOrigin = resolveExtractionWorkerOrigin(request);

  /** When the worker HTTP call fails without running the pipeline (4xx, gateway, network), run here. Skip on 500 so we do not double-run OpenAI if the worker failed mid-pipeline. */
  function shouldFallbackToInlinePipeline(status: number): boolean {
    if (status >= 500 && status !== 502 && status !== 503 && status !== 504) {
      return false;
    }
    return true;
  }

  async function finalizeUnexpectedInlineError() {
    try {
      const freshAdmin = await createAdminClient();
      await finishExtractionJob(
        freshAdmin,
        contractId,
        orgId,
        false,
        "Extraction failed unexpectedly. Please try again."
      );
    } catch (finishErr) {
      console.error("[api/extract] failed to finalize job after error:", finishErr);
      captureServerException(finishErr, {
        extra: { route: "api/extract", phase: "finalize-inline-failure", contractId },
      });
    }
  }

  if (internalHmacSecret || workerSecret) {
    after(async () => {
      try {
        const workerBody = JSON.stringify({
          contractId,
          userId: uid,
          organizationId: orgId,
        });
        const workerHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          ...(internalHmacSecret
            ? signInternalRequest({
                secret: internalHmacSecret,
                method: "POST",
                path: "/api/extract/run",
                body: workerBody,
                keyId: "current",
              })
            : { Authorization: `Bearer ${workerSecret}` }),
        };
        const res = await fetchWithRetry(
          `${workerOrigin}/api/extract/run`,
          {
            method: "POST",
            headers: workerHeaders,
            body: workerBody,
          },
          { maxAttempts: 4, baseDelayMs: 400 }
        );
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.error(
            "[api/extract] worker fetch failed:",
            res.status,
            t.slice(0, 500)
          );
          captureServerMessage("extraction worker fetch failed", {
            level: "error",
            extra: {
              contractId,
              status: res.status,
              body: t.slice(0, 500),
            },
          });
          if (shouldFallbackToInlinePipeline(res.status)) {
            captureServerMessage("extraction worker unreachable or rejected; running inline pipeline", {
              level: "warning",
              extra: { contractId, status: res.status },
            });
            try {
              await runExtractionPipeline({
                contractId,
                userId: uid,
                organizationId: orgId,
              });
              return;
            } catch (inlineErr) {
              console.error("[api/extract] inline fallback after worker failure:", inlineErr);
              captureServerException(inlineErr, {
                extra: { route: "api/extract", mode: "worker-fallback-inline", contractId },
              });
              await finalizeUnexpectedInlineError();
              return;
            }
          }
          const admin = await createAdminClient();
          const friendly =
            res.status >= 500
              ? "The extraction service is temporarily unavailable. Please try again."
              : "Could not start extraction. Please try again.";
          await finishExtractionJob(admin, contractId, orgId, false, friendly);
        }
      } catch (err) {
        console.error("[api/extract] worker fetch error:", err);
        captureServerException(err, { extra: { contractId } });
        captureServerMessage("extraction worker fetch threw; running inline pipeline", {
          level: "warning",
          extra: { contractId },
        });
        try {
          await runExtractionPipeline({
            contractId,
            userId: uid,
            organizationId: orgId,
          });
        } catch (inlineErr) {
          console.error("[api/extract] inline fallback after worker throw:", inlineErr);
          captureServerException(inlineErr, {
            extra: { route: "api/extract", mode: "worker-fallback-inline", contractId },
          });
          await finalizeUnexpectedInlineError();
        }
      }
    });
  } else {
    after(async () => {
      try {
        await runExtractionPipeline({
          admin,
          contractId,
          userId: uid,
          organizationId: orgId,
        });
      } catch (err) {
        console.error("[api/extract] after() pipeline error:", err);
        captureServerException(err, {
          extra: { route: "api/extract", mode: "inline-after", contractId },
        });
        try {
          const freshAdmin = await createAdminClient();
          await finishExtractionJob(
            freshAdmin,
            contractId,
            orgId,
            false,
            "Extraction failed unexpectedly. Please try again."
          );
        } catch (finishErr) {
          console.error("[api/extract] failed to finalize job after error:", finishErr);
          captureServerException(finishErr, {
            extra: { route: "api/extract", phase: "finalize-inline-failure", contractId },
          });
        }
      }
    });
  }

  return jsonOk(
    {
      accepted: true,
      async: true,
      message: "Extraction started",
    },
    { status: 202 }
  );
}
