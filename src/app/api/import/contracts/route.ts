import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitV10ObjectiveTelemetryEvent } from "@/lib/product-telemetry";
import { MAX_IMPORT_BODY_CHARS, parseCsv, runContractCsvImport } from "@/lib/import-jobs";
import { buildV10MutationResponse, buildV10MutationResponseInit } from "@/lib/v10-mutation-envelope";
import { findV10DuplicateImportCandidates, validateV10ImportCandidate } from "@/lib/v10-activation-state";
import {
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function getCsvHeaderColumns(csv: string): string[] {
  const [header = ""] = csv.split(/\r?\n/, 1);
  return header
    .split(",")
    .map((column) => column.trim().replace(/^"|"$/g, "").toLowerCase())
    .filter(Boolean);
}

function getRequestEncoding(contentType: string): string {
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim();
  return charset || "utf-8";
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function getImportCsvPayload(request: Request, contentType: string): Promise<{ csv: string } | { error: string }> {
  if (contentType.includes("text/csv")) {
    return { csv: await request.text() };
  }
  if (!contentType.includes("application/json")) {
    return { error: "Expected CSV or JSON import body." };
  }
  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) {
    return {
      error:
        _lb_body.response.status === 413
          ? "Import payload too large."
          : "Invalid JSON import body.",
    };
  }
  const body = (_lb_body.body ?? null) as
    | { csv?: unknown; rows?: Array<Record<string, unknown>> }
    | null;
  if (!body || typeof body !== "object") return { error: "Invalid JSON import body." };
  if (typeof body.csv === "string") return { csv: body.csv };
  if (Array.isArray(body.rows)) {
    const columns = ["title", "counterparty", "contract_type", "lifecycle_status"];
    const rows = body.rows.map((row) => columns.map((column) => csvCell(row[column])).join(","));
    return { csv: [columns.join(","), ...rows].join("\n") };
  }
  return { error: "JSON import body must include csv or rows." };
}

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
          ...PRIVATE_NO_STORE_HEADERS,
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
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv") && !contentType.includes("application/json")) {
    return NextResponse.json({ error: "Expected CSV or JSON import body." }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/import/contracts",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;
  if (!canEditContracts(membership.role as "admin" | "editor" | "viewer")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const payload = await getImportCsvPayload(request, contentType);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const { csv } = payload;
  if (csv.length > MAX_IMPORT_BODY_CHARS) {
    return NextResponse.json(
      { error: "Import payload too large. Split file and retry." },
      { status: 413, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  const parsedRows = parseCsv(csv);
  const parseErrorRows = parsedRows.filter((row) => !row.title?.trim() || !row.counterparty?.trim()).length;
  const duplicateGroups = findV10DuplicateImportCandidates(
    parsedRows.map((row, index) => ({
      rowId: `row_${index + 1}`,
      title: row.title ?? null,
      counterparty: row.counterparty ?? null,
      effectiveDate:
        (row as Record<string, string | undefined>).effective_date ??
        (row as Record<string, string | undefined>).effectiveDate ??
        null,
    }))
  );
  const validationFailures = validateV10ImportCandidate({
    columns: getCsvHeaderColumns(csv),
    rowCount: parsedRows.length,
    parseErrorRows,
    encoding: getRequestEncoding(contentType),
    duplicateRecordCount: duplicateGroups.reduce((count, group) => count + group.row_ids.length, 0),
  });
  if (validationFailures.length > 0) {
    const v10 = buildV10MutationResponse({
      outcome: "validation_failed",
      message: validationFailures[0]?.user_visible_message ?? "Import validation failed.",
      changedObjectType: "import_job",
      changedObjectId: null,
      diagnosticId: "v10_import_validation_failed",
      validationFailures,
    });
     return NextResponse.json(
       { error: v10.user_visible_message, v10 },
       buildV10MutationResponseInit(v10, { headers: PRIVATE_NO_STORE_HEADERS })
     );
  }
  const rows = parsedRows.filter((row) => row.title?.trim() && row.counterparty?.trim());
  const { response: v10Mutation, replayed } = await executeV10IdempotentMutation(
    admin,
    {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      mutationName: "create_contract_import",
      targetType: "import_job",
      targetId: membership.organization_id,
      idempotencyKey: getV10IdempotencyKeyFromRequest(request),
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: membership.organization_id,
      payload: {
        row_count: rows.length,
        content_type: contentType,
        body_length: csv.length,
      },
    },
    async () => {
      const result = await runContractCsvImport({
        admin,
        membership,
        userId: user.id,
        rows,
        source: "csv",
      });

      if (!result.jobId) {
        return buildV10MutationResponse({
          outcome: "validation_failed",
          message: result.error ?? "Could not create import job",
          changedObjectType: "import_job",
          changedObjectId: null,
          diagnosticId: "v10_import_job_missing",
        });
      }

      const outcome = result.success ? "success" : "validation_failed";
      const auditEventId = await recordV10AuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: result.success ? "import_job.created" : "import_job.failed",
        targetType: "import_job",
        targetId: result.jobId,
        outcome,
        safeMetadata: {
          row_count: rows.length,
          created_count: result.created,
          error_count: result.errors,
          duration_ms: result.durationMs,
        },
      });
      await emitV10ObjectiveTelemetryEvent(admin, {
        organizationId: membership.organization_id,
        userId: user.id,
        objectiveKey: "activation",
        action: "product.v10.activation_completed",
        details: {
          intake_surface: "contract_import",
          row_count: rows.length,
          created_count: result.created,
          error_count: result.errors,
          duplicate_group_count: duplicateGroups.length,
          audit_confirmed: Boolean(auditEventId),
        },
      }).catch(() => undefined);
      await emitV10ObjectiveTelemetryEvent(admin, {
        organizationId: membership.organization_id,
        userId: user.id,
        objectiveKey: "activation",
        action: "product.v10.import_extraction_failure_rate_sampled",
        details: {
          intake_surface: "contract_import",
          row_count: rows.length,
          error_count: result.errors,
          failure_rate_basis_points: rows.length > 0 ? Math.round((result.errors / rows.length) * 10_000) : 0,
        },
      }).catch(() => undefined);

      return buildV10MutationResponse({
        outcome: auditEventId ? outcome : "audit_write_failed",
        message: result.success ? "Import job created." : result.error ?? "Import failed",
        changedObjectType: "import_job",
        changedObjectId: result.jobId,
        newVersion: result.created,
        nextDestinationHref: `/api/import/contracts/${result.jobId}`,
        auditEventId,
        diagnosticId: result.success ? null : "v10_import_failed",
      });
    }
  );

  if (v10Mutation.outcome !== "success") {
    return NextResponse.json(
      {
        error: v10Mutation.user_visible_message,
        v10: v10Mutation,
      },
       buildV10MutationResponseInit(v10Mutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS })
    );
  }
  await refreshV10ReadModelsForOrganization(admin, membership.organization_id, {
    refreshScope: "one_model",
    reason: "contract_import_mutation",
    modelKeys: [
      "activation_state",
      "work_items",
      "contract_health_snapshots",
      "contract_activity_events",
      "job_run_visibility",
      "audit_events",
      "command_search_index",
    ],
  });

  return NextResponse.json(
    {
      success: true,
      jobId: v10Mutation.changed_object_id,
      created: typeof v10Mutation.new_version === "number" ? v10Mutation.new_version : null,
      errors: [],
      durationMs: null,
      replayed,
      v10: v10Mutation,
    },
    buildV10MutationResponseInit(v10Mutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS })
  );
}
