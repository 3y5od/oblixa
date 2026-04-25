import { NextResponse } from "next/server";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { MAX_IMPORT_BODY_CHARS, parseCsv, runContractCsvImport } from "@/lib/import-jobs";

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`import-contracts:${ip}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv") && !contentType.includes("application/json")) {
    return NextResponse.json({ error: "Expected CSV body." }, { status: 400 });
  }

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/import/contracts",
  });
  if (modeGate) return modeGate;
  if (!canEditContracts(membership.role as "admin" | "editor" | "viewer")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const csv = await request.text();
  if (csv.length > MAX_IMPORT_BODY_CHARS) {
    return NextResponse.json(
      { error: "Import payload too large. Split file and retry." },
      { status: 413 }
    );
  }
  const rows = parseCsv(csv).filter((r) => r.title?.trim());
  if (rows.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
  const result = await runContractCsvImport({
    admin,
    membership,
    userId: user.id,
    rows,
    source: "csv",
  });

  if (!result.jobId) {
    return NextResponse.json(
      { error: result.error ?? "Could not create import job" },
      { status: 400 }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Import failed", jobId: result.jobId },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    jobId: result.jobId,
    created: result.created,
    errors: result.errors,
    durationMs: result.durationMs,
  });
}
