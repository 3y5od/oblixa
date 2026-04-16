import { NextResponse } from "next/server";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { autoAttachProgramsForContract } from "@/lib/v4/program-auto-attach";
import { mapWithConcurrency } from "@/lib/extraction/concurrency";

type CsvRow = {
  title: string;
  counterparty?: string;
  contract_type?: string;
  owner_email?: string;
  region?: string;
  source_system?: string;
  external_reference_id?: string;
};

const CONTRACT_INSERT_BATCH_SIZE = 200;
const JOB_ROW_INSERT_BATCH_SIZE = 500;
const MAX_IMPORT_BODY_CHARS = 2_000_000;
const AUTO_ATTACH_PROGRAMS_CONCURRENCY = 6;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      continue;
    }
    currentField += ch;
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((values) => {
    const out: Record<string, string> = {};
    headers.forEach((h, idx) => {
      out[h] = values[idx] ?? "";
    });
    return out as CsvRow;
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
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

  const { data: createdJob, error: jobErr } = await admin
    .from("contract_import_jobs")
    .insert({
      organization_id: membership.organization_id,
      created_by: user.id,
      source: "csv",
      status: "processing",
      total_rows: rows.length,
    })
    .select("id")
    .single();
  if (jobErr || !createdJob) {
    return NextResponse.json({ error: jobErr?.message ?? "Could not create import job" }, { status: 400 });
  }
  const jobId = createdJob.id;

  const ownerEmails = [...new Set(rows.map((r) => r.owner_email?.toLowerCase().trim()).filter(Boolean))] as string[];
  const { data: profiles } =
    ownerEmails.length === 0
      ? { data: [] as Array<{ id: string; email: string }> }
      : await admin.from("profiles").select("id, email").in("email", ownerEmails);
  const ownerByEmail = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p.id]));

  const rowResults: Array<{
    rowIndex: number;
    title: string;
    ownerEmail: string | null;
    status: "valid" | "inserted" | "error";
    errorMessage: string | null;
    payload: Record<string, unknown> | null;
    contractId?: string | null;
  }> = rows.map((row, idx) => {
    const title = row.title.trim();
    const ownerEmail = row.owner_email?.toLowerCase().trim() ?? null;
    if (!title) {
      return {
        rowIndex: idx,
        title: row.title ?? "",
        ownerEmail,
        status: "error",
        errorMessage: "Missing title",
        payload: null,
      };
    }
    const ownerId = row.owner_email ? ownerByEmail.get(row.owner_email.toLowerCase().trim()) ?? null : null;
    if (ownerEmail && !ownerId) {
      return {
        rowIndex: idx,
        title,
        ownerEmail,
        status: "error",
        errorMessage: "Owner email not found in workspace",
        payload: null,
      };
    }
    return {
      rowIndex: idx,
      title,
      ownerEmail,
      status: "valid" as const,
      errorMessage: null,
      payload: {
      organization_id: membership.organization_id,
      title,
      counterparty: row.counterparty?.trim() || null,
      contract_type: row.contract_type?.trim() || null,
      region: row.region?.trim() || null,
      owner_id: ownerId,
      created_by: user.id,
      status: "pending_review" as const,
      intake_status: "awaiting_review" as const,
      intake_source: row.source_system?.trim() || "csv_import",
      source_system: row.source_system?.trim() || "csv_import",
      external_reference_id: row.external_reference_id?.trim() || null,
      required_next_step: "Review imported metadata",
      },
    };
  });

  const validRows = rowResults.filter((r) => r.status === "valid" && r.payload) as Array<
    Required<Pick<(typeof rowResults)[number], "payload" | "rowIndex">> & (typeof rowResults)[number]
  >;
  if (validRows.length > 0) {
    const chunks = chunkArray(validRows, CONTRACT_INSERT_BATCH_SIZE);
    for (const chunk of chunks) {
      const { data: inserted, error } = await admin
        .from("contracts")
        .insert(chunk.map((r) => r.payload))
        .select("id");
      if (error) {
        await admin
          .from("contract_import_jobs")
          .update({
            status: "failed",
            valid_rows: validRows.length,
            error_rows: rows.length - validRows.length,
          })
          .eq("id", jobId);
        return NextResponse.json({ error: error.message, jobId }, { status: 400 });
      }
      for (let i = 0; i < chunk.length; i++) {
        chunk[i].contractId = inserted?.[i]?.id ?? null;
        chunk[i].status = inserted?.[i]?.id ? "inserted" : "error";
        if (!inserted?.[i]?.id) chunk[i].errorMessage = "Insert failed";
      }
      const insertedWithPayload = chunk.filter((row): row is (typeof chunk)[number] & { contractId: string } =>
        typeof row.contractId === "string" && !!row.payload
      );
      await mapWithConcurrency(
        insertedWithPayload,
        AUTO_ATTACH_PROGRAMS_CONCURRENCY,
        async (row) => {
          const p = row.payload as Record<string, unknown>;
          await autoAttachProgramsForContract({
            admin,
            contract: {
              id: row.contractId,
              organization_id: String(p.organization_id),
              contract_type: (p.contract_type as string | null) ?? null,
              source_system: (p.source_system as string | null) ?? null,
              counterparty: (p.counterparty as string | null) ?? null,
              region: (p.region as string | null) ?? null,
              intake_source: (p.intake_source as string | null) ?? null,
            },
            actorUserId: user.id,
          }).catch(() => undefined);
          return null;
        }
      );
    }
  }

  const jobRowsPayload = rowResults.map((row) => ({
    job_id: jobId,
    organization_id: membership.organization_id,
    row_index: row.rowIndex,
    title: row.title,
    owner_email: row.ownerEmail,
    status: row.status,
    error_message: row.errorMessage,
    contract_id: row.contractId ?? null,
  }));
  for (const chunk of chunkArray(jobRowsPayload, JOB_ROW_INSERT_BATCH_SIZE)) {
    await admin.from("contract_import_job_rows").insert(chunk);
  }

  const insertedRows = rowResults.filter((r) => r.status === "inserted").length;
  const validCount = rowResults.filter((r) => r.status !== "error").length;
  const errorRows = rowResults.filter((r) => r.status === "error").length;

  await admin
    .from("contract_import_jobs")
    .update({
      status: "completed",
      valid_rows: validCount,
      inserted_rows: insertedRows,
      error_rows: errorRows,
    })
    .eq("id", jobId);

  return NextResponse.json({
    success: true,
    jobId,
    created: insertedRows,
    errors: errorRows,
    durationMs: Date.now() - startedAt,
  });
}
