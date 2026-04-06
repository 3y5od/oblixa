import { createAdminClient } from "@/lib/supabase/server";
import { MAX_EXTRACTION_ATTEMPTS } from "@/lib/extraction/constants";

export { MAX_EXTRACTION_ATTEMPTS };

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export async function startExtractionJob(
  admin: Admin,
  contractId: string,
  organizationId: string
): Promise<{ ok: true; attempt: number } | { ok: false; error: string; status: number }> {
  const { data: existing } = await admin
    .from("contract_extraction_jobs")
    .select("attempt_count")
    .eq("contract_id", contractId)
    .maybeSingle();

  const current = existing?.attempt_count ?? 0;
  if (current >= MAX_EXTRACTION_ATTEMPTS) {
    return {
      ok: false,
      error: `Extraction was attempted ${MAX_EXTRACTION_ATTEMPTS} times. Contact support if this keeps failing.`,
      status: 429,
    };
  }

  const next = current + 1;
  const now = new Date().toISOString();

  if (existing) {
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
      return { ok: false, error: error.message, status: 500 };
    }
  } else {
    const { error } = await admin.from("contract_extraction_jobs").insert({
      contract_id: contractId,
      organization_id: organizationId,
      status: "processing",
      attempt_count: next,
      last_error: null,
      started_at: now,
      completed_at: null,
    });

    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
  }

  return { ok: true, attempt: next };
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
