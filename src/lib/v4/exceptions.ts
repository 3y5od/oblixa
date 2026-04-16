import { createAdminClient } from "@/lib/supabase/server";
import { appendCasefileEvent } from "@/lib/v4/casefile";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export type DetectedExceptionInput = {
  organizationId: string;
  contractId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  exceptionType: string;
  title: string;
  details?: string | null;
  severity: "low" | "medium" | "high" | "critical";
};

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "");
}

export function buildExceptionFingerprint(input: {
  organizationId: string;
  contractId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  exceptionType: string;
}) {
  return [
    normalizeToken(input.organizationId),
    normalizeToken(input.exceptionType),
    normalizeToken(input.linkedEntityType || "contract"),
    normalizeToken(input.linkedEntityId || input.contractId || "none"),
  ].join(":");
}

export async function upsertDetectedExceptions(input: {
  admin: AdminClient;
  detector: string;
  rows: DetectedExceptionInput[];
}) {
  if (input.rows.length === 0) {
    return { touched: 0 };
  }

  const upserts = input.rows.map((row) => ({
    organization_id: row.organizationId,
    contract_id: row.contractId,
    linked_entity_type: row.linkedEntityType,
    linked_entity_id: row.linkedEntityId,
    exception_type: row.exceptionType,
    title: row.title,
    details: row.details ?? null,
    severity: row.severity,
    fingerprint: buildExceptionFingerprint({
      organizationId: row.organizationId,
      contractId: row.contractId,
      linkedEntityType: row.linkedEntityType,
      linkedEntityId: row.linkedEntityId,
      exceptionType: row.exceptionType,
    }),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await input.admin
    .from("exceptions")
    .upsert(upserts, { onConflict: "organization_id,fingerprint", ignoreDuplicates: false })
    .select("id, organization_id, contract_id");
  if (error) {
    throw new Error(error.message);
  }

  const touchedRows = data ?? [];
  if (touchedRows.length === 0) {
    return { touched: 0 };
  }

  await input.admin.from("exception_events").insert(
    touchedRows.map((row) => ({
      organization_id: row.organization_id,
      exception_id: row.id,
      event_type: "detected",
      actor_user_id: null,
      details: { detector: input.detector },
    }))
  );

  for (const row of touchedRows) {
    if (!row.contract_id) continue;
    await appendCasefileEvent({
      admin: input.admin,
      organizationId: row.organization_id,
      contractId: row.contract_id,
      eventType: "exception.detected",
      entityType: "exception",
      entityId: row.id,
      details: { detector: input.detector },
    });
  }

  return { touched: touchedRows.length };
}
