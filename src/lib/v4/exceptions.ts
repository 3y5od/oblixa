import { createAdminClient } from "@/lib/supabase/server";
import { appendCasefileEvent } from "@/lib/v4/casefile";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type TouchedExceptionRow = {
  id: string;
  organization_id: string;
  contract_id: string | null;
};

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

async function selectExistingExceptionRow(input: {
  admin: AdminClient;
  organizationId: string;
  fingerprint: string;
}): Promise<TouchedExceptionRow> {
  const { data, error } = await input.admin
    .from("exceptions")
    .select("id, organization_id, contract_id")
    .eq("organization_id", input.organizationId)
    .eq("fingerprint", input.fingerprint)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id || !data.organization_id) {
    throw new Error(`existing exception row missing for fingerprint ${input.fingerprint}`);
  }

  return {
    id: data.id,
    organization_id: data.organization_id,
    contract_id: data.contract_id ?? null,
  };
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

  const touchedRows: TouchedExceptionRow[] = [];
  for (const row of upserts) {
    const insertResult = await input.admin
      .from("exceptions")
      .insert(row)
      .select("id, organization_id, contract_id")
      .maybeSingle();

    if (!insertResult.error && insertResult.data?.id && insertResult.data.organization_id) {
      touchedRows.push({
        id: insertResult.data.id,
        organization_id: insertResult.data.organization_id,
        contract_id: insertResult.data.contract_id ?? null,
      });
      continue;
    }

    if (insertResult.error?.code !== "23505") {
      throw new Error(insertResult.error?.message ?? "exception insert did not return a row");
    }

    const existingRow = await selectExistingExceptionRow({
      admin: input.admin,
      organizationId: row.organization_id,
      fingerprint: row.fingerprint,
    });

    const { error: updateError } = await input.admin
      .from("exceptions")
      .update({
        contract_id: row.contract_id,
        linked_entity_type: row.linked_entity_type,
        linked_entity_id: row.linked_entity_id,
        exception_type: row.exception_type,
        title: row.title,
        details: row.details,
        severity: row.severity,
        updated_at: row.updated_at,
      })
      .eq("id", existingRow.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    touchedRows.push({
      ...existingRow,
      contract_id: row.contract_id,
    });
  }

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
