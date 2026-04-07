import { NextResponse, after } from "next/server";
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

/** Large PDFs + OpenAI can exceed default serverless limits on some hosts */
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const rawId =
    body !== null &&
    typeof body === "object" &&
    "contractId" in body &&
    (body as { contractId: unknown }).contractId != null
      ? String((body as { contractId: unknown }).contractId).trim()
      : "";

  if (!rawId) {
    return NextResponse.json({ error: "contractId required" }, { status: 400 });
  }

  if (!isUuid(rawId)) {
    return NextResponse.json({ error: "Invalid contractId" }, { status: 400 });
  }

  const contractId = rawId;

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ip = getClientIpFromRequest(request);
  const rateKey = user ? `extract:${user.id}:${ip}` : `extract:anon:${ip}`;
  const rl = await rateLimitCheck(rateKey, RATE_LIMITS.extract);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many extraction requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", contract.organization_id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) {
    return NextResponse.json({ error: "Viewers cannot run extraction" }, { status: 403 });
  }
  if (
    isPlanEnforcementEnabled() &&
    !(await orgHasActivePlan(admin, contract.organization_id))
  ) {
    return NextResponse.json(
      { error: "An active subscription is required" },
      { status: 402 }
    );
  }

  const jobStart = await startExtractionJob(
    admin,
    contractId,
    contract.organization_id
  );
  if (!jobStart.ok) {
    // Idempotent: duplicate POSTs (double-click, slow network) race here; the first
    // request already set processing + scheduled work — treat as accepted, not an error.
    if (jobStart.status === 409) {
      return NextResponse.json(
        {
          accepted: true,
          async: true,
          message: "Extraction already in progress",
        },
        { status: 202 }
      );
    }
    return NextResponse.json(
      { error: jobStart.error },
      { status: jobStart.status }
    );
  }

  const orgId = contract.organization_id;
  const uid = user.id;
  const workerSecret = process.env.EXTRACTION_WORKER_SECRET?.trim();
  const workerOrigin = resolveExtractionWorkerOrigin(request);

  if (workerSecret) {
    after(async () => {
      try {
        const res = await fetchWithRetry(
          `${workerOrigin}/api/extract/run`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${workerSecret}`,
            },
            body: JSON.stringify({
              contractId,
              userId: uid,
              organizationId: orgId,
            }),
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
          const admin = await createAdminClient();
          const friendly =
            res.status >= 500
              ? "The extraction service is temporarily unavailable. Please try again."
              : "Could not start extraction. Please try again.";
          await finishExtractionJob(admin, contractId, false, friendly);
        }
      } catch (err) {
        console.error("[api/extract] worker fetch error:", err);
        captureServerException(err, { extra: { contractId } });
        const admin = await createAdminClient();
        await finishExtractionJob(
          admin,
          contractId,
          false,
          "Could not start extraction. Please try again."
        );
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

  return NextResponse.json(
    {
      accepted: true,
      async: true,
      message: "Extraction started",
    },
    { status: 202 }
  );
}
