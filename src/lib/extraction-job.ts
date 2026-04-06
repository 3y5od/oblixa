import { createAdminClient } from "@/lib/supabase/server";
import {
  isExtractionActivelyBlocking,
  MAX_EXTRACTION_ATTEMPTS,
} from "@/lib/extraction/constants";

export { MAX_EXTRACTION_ATTEMPTS };
export { EXTRACTION_PROCESSING_STALE_MS } from "@/lib/extraction/constants";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

type JobRow = {
  status: string;
  attempt_count: number | null;
  started_at: string | null;
};

async function countContractFiles(admin: Admin, contractId: string): Promise<number | null> {
  const { count, error } = await admin
    .from("contract_files")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId);
  if (error) {
    console.error("[extraction-job] contract_files count:", error.message);
    return null;
  }
  return count ?? 0;
}

/** Postgres unique_violation — e.g. concurrent inserts for the same contract_id */
function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return (
    typeof error.message === "string" &&
    error.message.includes("duplicate key value violates unique constraint")
  );
}

function anotherRunIsInFlight(row: JobRow): boolean {
  return (
    row.status === "processing" && isExtractionActivelyBlocking(row.started_at)
  );
}

const MAX_START_RECURSION = 2;

export async function startExtractionJob(
  admin: Admin,
  contractId: string,
  organizationId: string,
  _recursionDepth = 0
): Promise<{ ok: true; attempt: number } | { ok: false; error: string; status: number }> {
  if (_recursionDepth > MAX_START_RECURSION) {
    return {
      ok: false as const,
      error: "Could not start extraction. Refresh the page and try again.",
      status: 500,
    };
  }
  const applyProcessingUpdate = async (
    priorAttemptCount: number
  ): Promise<
    { ok: true; attempt: number } | { ok: false; error: string; status: number }
  > => {
    if (priorAttemptCount >= MAX_EXTRACTION_ATTEMPTS) {
      return {
        ok: false as const,
        error: `Extraction was attempted ${MAX_EXTRACTION_ATTEMPTS} times. Contact support if this keeps failing.`,
        status: 429,
      };
    }

    const next = priorAttemptCount + 1;
    const now = new Date().toISOString();

    const { error } = await admin
      .from("contract_extraction_jobs")
      .update({
        status: "processing",
        attempt_count: next,
        last_error: null,
        started_at: now,
        completed_at: null,
      })
      .eq("contract_id", contractId);

    if (error) {
      return { ok: false as const, error: error.message, status: 500 };
    }

    return { ok: true as const, attempt: next };
  };

  const proceedFromExistingRow = async (row: JobRow) => {
    if (anotherRunIsInFlight(row)) {
      // Stuck "processing" with no files (e.g. files removed after a failed background run, or crash before finish).
      const fileCount = await countContractFiles(admin, contractId);
      if (fileCount === 0) {
        const { error: delErr } = await admin
          .from("contract_extraction_jobs")
          .delete()
          .eq("contract_id", contractId);
        if (delErr) {
          return {
            ok: false as const,
            error: "Could not reset extraction state. Try again or refresh the page.",
            status: 500,
          };
        }
        return startExtractionJob(
          admin,
          contractId,
          organizationId,
          _recursionDepth + 1
        );
      }
      return {
        ok: false as const,
        error:
          "An extraction is already running for this contract. Wait for it to finish or refresh the page.",
        status: 409,
      };
    }
    return applyProcessingUpdate(row.attempt_count ?? 0);
  };

  const { data: existing } = await admin
    .from("contract_extraction_jobs")
    .select("status, attempt_count, started_at")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (existing) {
    return proceedFromExistingRow(existing as JobRow);
  }

  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("contract_extraction_jobs").insert({
    contract_id: contractId,
    organization_id: organizationId,
    status: "processing",
    attempt_count: 1,
    last_error: null,
    started_at: now,
    completed_at: null,
  });

  if (!insertError) {
    return { ok: true as const, attempt: 1 };
  }

  // Another request inserted the row first (race). Re-fetch and continue as update or 409.
  if (isUniqueViolation(insertError)) {
    const { data: raced, error: fetchErr } = await admin
      .from("contract_extraction_jobs")
      .select("status, attempt_count, started_at")
      .eq("contract_id", contractId)
      .maybeSingle();

    if (fetchErr || !raced) {
      return {
        ok: false as const,
        error: "Could not start extraction job. Please try again.",
        status: 500,
      };
    }

    return proceedFromExistingRow(raced as JobRow);
  }

  return { ok: false as const, error: insertError.message, status: 500 };
}

export async function finishExtractionJob(
  admin: Admin,
  contractId: string,
  success: boolean,
  errorMessage?: string
) {
  const now = new Date().toISOString();
  await admin
    .from("contract_extraction_jobs")
    .update({
      status: success ? "succeeded" : "failed",
      last_error: success ? null : (errorMessage ?? "Extraction failed"),
      completed_at: now,
    })
    .eq("contract_id", contractId);
}
