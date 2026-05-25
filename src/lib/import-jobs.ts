import { autoAttachProgramsForContract } from "@/lib/contract-operations/program-auto-attach";
import { mapWithConcurrency } from "@/lib/extraction/concurrency";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { stripCsvBidiControlCharacters } from "@/lib/csv-formula-safe";
import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/server";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export type CsvRow = {
  title: string;
  counterparty?: string;
  contract_type?: string;
  owner_email?: string;
  region?: string;
  source_system?: string;
  external_reference_id?: string;
};

type ImportMembership = {
  organization_id: string;
};

type ImportRowResult = {
  rowIndex: number;
  title: string;
  ownerEmail: string | null;
  status: "valid" | "inserted" | "error";
  errorMessage: string | null;
  payload: Record<string, unknown> | null;
  rawPayload: CsvRow;
  contractId?: string | null;
};

const CONTRACT_INSERT_BATCH_SIZE = 200;
const JOB_ROW_INSERT_BATCH_SIZE = 500;
const AUTO_ATTACH_PROGRAMS_CONCURRENCY = 6;
export const MAX_IMPORT_BODY_CHARS = 2_000_000;
export const MAX_IMPORT_CSV_ROWS = 10_000;
export const MAX_IMPORT_CSV_COLUMNS = 100;
export const MAX_IMPORT_CSV_CELL_CHARS = 8_192;
const CSV_FORMULA_PREFIX_RE = /^[\t\r]|^[\s]*[=+\-@]/;
const IMPORT_RAW_PAYLOAD_TTL_DAYS = 30;

async function resolveWorkspaceOwnerIdsByEmail(
  admin: Admin,
  organizationId: string,
  ownerEmails: string[]
): Promise<Map<string, string>> {
  if (ownerEmails.length === 0) return new Map();

  const normalizedEmails = new Set(ownerEmails.map((email) => email.toLowerCase().trim()));
  const members = await loadOrgMemberProfileRows(admin, organizationId);

  return new Map(
    members.flatMap((member) => {
      const email = member.profiles?.email?.toLowerCase().trim() ?? null;
      return email && normalizedEmails.has(email) ? [[email, member.user_id] as const] : [];
    })
  );
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    if (currentRow.length < MAX_IMPORT_CSV_COLUMNS) {
      currentRow.push(normalizeCsvImportCell(currentField));
    }
    currentField = "";
  };
  const pushRow = () => {
    if (currentRow.some((cell) => cell.length > 0) && rows.length <= MAX_IMPORT_CSV_ROWS) {
      rows.push(currentRow);
    }
    currentRow = [];
  };
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
      pushField();
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      pushField();
      pushRow();
      continue;
    }
    if (currentField.length < MAX_IMPORT_CSV_CELL_CHARS) currentField += ch;
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    pushField();
    pushRow();
  }
  if (rows.length < 2) return [];
  const headers = rows[0].slice(0, MAX_IMPORT_CSV_COLUMNS).map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((values) => {
    const out: Record<string, string> = {};
    headers.forEach((h, idx) => {
      out[h] = values[idx] ?? "";
    });
    return out as CsvRow;
  });
}

export function normalizeCsvImportCell(value: string): string {
  const stripped = stripCsvBidiControlCharacters(value).trim();
  if (CSV_FORMULA_PREFIX_RE.test(stripped)) return `'${stripped}`;
  return stripped;
}

function normalizeRetryRow(raw: unknown): CsvRow | null {
  if (!raw || typeof raw !== "object") return null;
  const container = raw as Record<string, unknown>;
  const row =
    container.schema_version === 1 && container.retry_fields && typeof container.retry_fields === "object"
      ? (container.retry_fields as Record<string, unknown>)
      : container;
  const title = typeof row.title === "string" ? row.title : "";
  if (!title.trim()) return null;
  return {
    title,
    counterparty: typeof row.counterparty === "string" ? row.counterparty : undefined,
    contract_type: typeof row.contract_type === "string" ? row.contract_type : undefined,
    owner_email: typeof row.owner_email === "string" ? row.owner_email : undefined,
    region: typeof row.region === "string" ? row.region : undefined,
    source_system: typeof row.source_system === "string" ? row.source_system : undefined,
    external_reference_id:
      typeof row.external_reference_id === "string" ? row.external_reference_id : undefined,
  };
}

function stablePayloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function expiresAtAfter(days: number, now = new Date()): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function minimizeImportRawPayload(row: CsvRow, now = new Date()): Record<string, unknown> {
  const retryFields: CsvRow = {
    title: normalizeCsvImportCell(row.title ?? ""),
    counterparty: row.counterparty ? normalizeCsvImportCell(row.counterparty) : undefined,
    contract_type: row.contract_type ? normalizeCsvImportCell(row.contract_type) : undefined,
    owner_email: row.owner_email ? normalizeCsvImportCell(row.owner_email).toLowerCase() : undefined,
    region: row.region ? normalizeCsvImportCell(row.region) : undefined,
    source_system: row.source_system ? normalizeCsvImportCell(row.source_system) : undefined,
    external_reference_id: row.external_reference_id ? normalizeCsvImportCell(row.external_reference_id) : undefined,
  };
  return {
    schema_version: 1,
    payload_hash_sha256: stablePayloadHash(row),
    retained_for: "retry_normalized_fields",
    ttl_expires_at: expiresAtAfter(IMPORT_RAW_PAYLOAD_TTL_DAYS, now),
    raw_payload_minimized: true,
    retry_fields: Object.fromEntries(
      Object.entries(retryFields).filter(([, value]) => typeof value === "string" && value.length > 0)
    ),
  };
}

async function insertJobRows(
  admin: Admin,
  organizationId: string,
  jobId: string,
  rowResults: ImportRowResult[]
) {
  const jobRowsPayload = rowResults.map((row) => ({
    job_id: jobId,
    organization_id: organizationId,
    row_index: row.rowIndex,
    title: row.title,
    owner_email: row.ownerEmail,
    status: row.status,
    error_message: row.errorMessage,
    contract_id: row.contractId ?? null,
    raw_payload: minimizeImportRawPayload(row.rawPayload),
  }));
  for (const chunk of chunkArray(jobRowsPayload, JOB_ROW_INSERT_BATCH_SIZE)) {
    await admin.from("contract_import_job_rows").insert(chunk);
  }
}

export async function loadRetryableImportRows(
  admin: Admin,
  organizationId: string,
  jobId: string
): Promise<{ rows: CsvRow[]; status: string | null; supersededByJobId: string | null }> {
  const { data: sourceJob } = await admin
    .from("contract_import_jobs")
    .select("id, status, superseded_by_job_id")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!sourceJob) {
    return { rows: [], status: null, supersededByJobId: null };
  }

  const { data: sourceRows } = await admin
    .from("contract_import_job_rows")
    .select("status, raw_payload")
    .eq("job_id", jobId)
    .eq("organization_id", organizationId)
    .order("row_index", { ascending: true });

  const retryRows = (sourceRows ?? [])
    .filter((row) => row.status === "error")
    .map((row) => normalizeRetryRow(row.raw_payload))
    .filter((row): row is CsvRow => Boolean(row));

  return {
    rows: retryRows,
    status: sourceJob.status ?? null,
    supersededByJobId: sourceJob.superseded_by_job_id ?? null,
  };
}

export async function runContractCsvImport(params: {
  admin: Admin;
  membership: ImportMembership;
  userId: string;
  rows: CsvRow[];
  source?: "csv" | "retry";
  retryOfJobId?: string | null;
}): Promise<{
  success: boolean;
  jobId: string;
  created: number;
  errors: number;
  durationMs: number;
  error?: string;
}> {
  const { admin, membership, userId, rows, source = "csv", retryOfJobId = null } = params;
  const startedAt = Date.now();

  const { data: createdJob, error: jobErr } = await admin
    .from("contract_import_jobs")
    .insert({
      organization_id: membership.organization_id,
      created_by: userId,
      source,
      status: "processing",
      total_rows: rows.length,
      retry_of_job_id: retryOfJobId,
    })
    .select("id")
    .single();

  if (jobErr || !createdJob) {
    return {
      success: false,
      jobId: "",
      created: 0,
      errors: 0,
      durationMs: Date.now() - startedAt,
      error: jobErr?.message ?? "Could not create import job",
    };
  }

  const jobId = createdJob.id;

  await emitProductTelemetryEvent(admin, {
    organizationId: membership.organization_id,
    userId,
    action: "product.v9.import_started",
    details: {
      job_row_count: rows.length,
      source,
      retry_of_job: Boolean(retryOfJobId),
    },
  });

  const ownerEmails = [...new Set(rows.map((r) => r.owner_email?.toLowerCase().trim()).filter(Boolean))] as string[];
  const ownerByEmail = await resolveWorkspaceOwnerIdsByEmail(
    admin,
    membership.organization_id,
    ownerEmails
  );

  const rowResults: ImportRowResult[] = rows.map((row, idx) => {
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
        rawPayload: row,
      };
    }
    const ownerId = ownerEmail ? ownerByEmail.get(ownerEmail) ?? null : null;
    if (ownerEmail && !ownerId) {
      return {
        rowIndex: idx,
        title,
        ownerEmail,
        status: "error",
        errorMessage: "Owner email not found in workspace",
        payload: null,
        rawPayload: row,
      };
    }
    return {
      rowIndex: idx,
      title,
      ownerEmail,
      status: "valid",
      errorMessage: null,
      rawPayload: row,
      payload: {
        organization_id: membership.organization_id,
        title,
        counterparty: row.counterparty?.trim() || null,
        contract_type: row.contract_type?.trim() || null,
        region: row.region?.trim() || null,
        owner_id: ownerId,
        created_by: userId,
        status: "pending_review" as const,
        intake_status: "awaiting_review" as const,
        intake_source: row.source_system?.trim() || "csv_import",
        source_system: row.source_system?.trim() || "csv_import",
        external_reference_id: row.external_reference_id?.trim() || null,
        required_next_step: "Review imported metadata",
      },
    };
  });

  const validRows = rowResults.filter(
    (row): row is ImportRowResult & { payload: Record<string, unknown> } =>
      row.status === "valid" && row.payload !== null
  );
  let fatalInsertError: string | null = null;

  if (validRows.length > 0) {
    const chunks = chunkArray(validRows, CONTRACT_INSERT_BATCH_SIZE);
    for (const chunk of chunks) {
      const { data: inserted, error } = await admin
        .from("contracts")
        .insert(chunk.map((row) => row.payload))
        .select("id");

      if (error) {
        fatalInsertError = error.message;
        for (const pendingRow of chunk) {
          pendingRow.status = "error";
          pendingRow.errorMessage = "Import stopped before this row could be created.";
        }
        break;
      }

      for (let i = 0; i < chunk.length; i++) {
        chunk[i].contractId = inserted?.[i]?.id ?? null;
        chunk[i].status = inserted?.[i]?.id ? "inserted" : "error";
        if (!inserted?.[i]?.id) {
          chunk[i].errorMessage = "Insert failed";
        }
      }

      const insertedWithPayload = chunk.filter(
        (row): row is ImportRowResult & { contractId: string; payload: Record<string, unknown> } =>
          typeof row.contractId === "string" && !!row.payload
      );
      await mapWithConcurrency(insertedWithPayload, AUTO_ATTACH_PROGRAMS_CONCURRENCY, async (row) => {
        const payload = row.payload;
        await autoAttachProgramsForContract({
          admin,
          contract: {
            id: row.contractId,
            organization_id: String(payload.organization_id),
            contract_type: (payload.contract_type as string | null) ?? null,
            source_system: (payload.source_system as string | null) ?? null,
            counterparty: (payload.counterparty as string | null) ?? null,
            region: (payload.region as string | null) ?? null,
            intake_source: (payload.intake_source as string | null) ?? null,
          },
          actorUserId: userId,
        }).catch(() => undefined);
        return null;
      });
    }
  }

  if (fatalInsertError) {
    for (const row of rowResults) {
      if (row.status === "valid") {
        row.status = "error";
        row.errorMessage = "Import stopped before this row could be created.";
      }
    }
  }

  await insertJobRows(admin, membership.organization_id, jobId, rowResults);

  const insertedRows = rowResults.filter((row) => row.status === "inserted").length;
  const errorRows = rowResults.filter((row) => row.status === "error").length;
  const validCount = rowResults.length - errorRows;

  await admin
    .from("contract_import_jobs")
    .update({
      status: fatalInsertError ? "failed" : "completed",
      valid_rows: validCount,
      inserted_rows: insertedRows,
      error_rows: errorRows,
      failure_reason: fatalInsertError,
      completed_at: new Date().toISOString(),
    })
    .eq("organization_id", membership.organization_id)
    .eq("id", jobId);

  if (retryOfJobId) {
    await admin
      .from("contract_import_jobs")
      .update({ superseded_by_job_id: jobId })
      .eq("id", retryOfJobId)
      .eq("organization_id", membership.organization_id);
  }

  const action = fatalInsertError
    ? "product.v9.import_failed"
    : errorRows > 0
      ? "product.v9.import_partially_completed"
      : "product.v9.import_completed";

  await emitProductTelemetryEvent(admin, {
    organizationId: membership.organization_id,
    userId,
    action,
    details: {
      job_row_count: rows.length,
      valid_row_count: validCount,
      inserted_row_count: insertedRows,
      error_row_count: errorRows,
      duration_ms: Date.now() - startedAt,
      retry_of_job: Boolean(retryOfJobId),
    },
  });

  return {
    success: !fatalInsertError,
    jobId,
    created: insertedRows,
    errors: errorRows,
    durationMs: Date.now() - startedAt,
    error: fatalInsertError ?? undefined,
  };
}
