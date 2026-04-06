import { NextResponse, after } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { runExtractionPipeline } from "@/lib/extraction/run-pipeline";
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
    return NextResponse.json(
      { error: jobStart.error },
      { status: jobStart.status }
    );
  }

  const orgId = contract.organization_id;
  const uid = user.id;

  after(async () => {
    try {
      await runExtractionPipeline({
        contractId,
        userId: uid,
        organizationId: orgId,
      });
    } catch (err) {
      console.error("[api/extract] after() pipeline error:", err);
    }
  });

  return NextResponse.json(
    {
      accepted: true,
      async: true,
      message: "Extraction started",
    },
    { status: 202 }
  );
}
