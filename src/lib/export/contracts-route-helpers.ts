import { after, NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
} from "@/lib/mutation-envelope";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { executeContractExportCsv } from "@/lib/export/contracts-csv";
import { createAdminClient } from "@/lib/supabase/server";
import { validateV10IdempotencyKey } from "@/lib/mutation-envelope";
import { isUuid } from "@/lib/security/validation";

type ContractExportCsvInput = Parameters<typeof executeContractExportCsv>[0];
type RecordAuditEvent =
  typeof import("@/lib/server-contracts").recordV10AuditEvent;

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const ROUTE = "/api/export/contracts";

export function exportProblem(
  status: number,
  error: string,
  code: string,
  diagnosticId: string,
  details?: Record<string, unknown>,
) {
  return jsonProblem(status, {
    error,
    code,
    diagnostic_id: diagnosticId,
    route: ROUTE,
    ...(details ? { details } : {}),
  });
}

export function exportJobCreateFailureResponse() {
  const failure = buildV10MutationResponse({
    outcome: "server_error",
    message: "The export job could not be created.",
    changedObjectType: "export_job",
    changedObjectId: null,
    diagnosticId: "v10_export_job_create_failed",
  });
  const init = buildV10MutationResponseInit(failure, {
    headers: PRIVATE_NO_STORE_HEADERS,
  });
  return jsonProblem(
    init.status ?? 500,
    {
      error: failure.user_visible_message,
      code: String(failure.outcome),
      diagnostic_id: failure.diagnostic_id ?? "v10_export_job_create_failed",
      route: ROUTE,
      details: { v10: failure },
    },
    { headers: init.headers },
  );
}

export function exportMutationValidationResponse(input: {
  message: string;
  diagnosticId: string;
  field: string;
  code: string;
  userVisibleMessage: string;
}) {
  const response = buildV10MutationResponse({
    outcome: "validation_failed",
    message: input.message,
    diagnosticId: input.diagnosticId,
    validationFailures: [
      {
        field: input.field,
        code: input.code,
        user_visible_message: input.userVisibleMessage,
        self_fixable: true,
      },
    ],
  });
  return NextResponse.json(
    response,
    buildV10MutationResponseInit(response, {
      headers: PRIVATE_NO_STORE_HEADERS,
    }),
  );
}

export function validateExportContractsPostHeaders(
  request: Request,
  idempotencyKey: string | null,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!idempotencyKey || !validateV10IdempotencyKey(idempotencyKey)) {
    return exportMutationValidationResponse({
      message:
        "A valid x-idempotency-key header is required for this V10 export mutation.",
      diagnosticId: "v10_export_idempotency_key_invalid",
      field: "x-idempotency-key",
      code: "invalid_format",
      userVisibleMessage: "Use a unique retry key for this export.",
    });
  }
  if (!contentType.includes("application/json")) {
    return exportMutationValidationResponse({
      message:
        "Use Content-Type: application/json with an object body for this export request.",
      diagnosticId: "v10_export_content_type_invalid",
      field: "content-type",
      code: "application_json_required",
      userVisibleMessage: "Send this export request as JSON.",
    });
  }
  return null;
}

export function parseExportContractsPostBody(raw: unknown):
  | {
      ok: true;
      orgId: string;
      contractIdsParam: string;
      url: URL;
      filterJsonExtension?: Record<string, unknown>;
    }
  | { ok: false; response: NextResponse } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      response: exportMutationValidationResponse({
        message: "The export request body must be a JSON object.",
        diagnosticId: "v10_export_body_object_required",
        field: "body",
        code: "object_required",
        userVisibleMessage: "Send a JSON object for export settings.",
      }),
    };
  }

  const obj = raw as Record<string, unknown>;
  if ("filter_json" in obj) {
    const fj = obj.filter_json;
    if (
      fj !== undefined &&
      (typeof fj !== "object" || fj === null || Array.isArray(fj))
    ) {
      return {
        ok: false,
        response: exportMutationValidationResponse({
          message:
            "filter_json must be a JSON object. Remove the field or send an empty object {}.",
          diagnosticId: "v10_export_filter_json_invalid",
          field: "filter_json",
          code: "object_required",
          userVisibleMessage: "Remove filter_json or send an empty object.",
        }),
      };
    }
  }

  const orgId = typeof obj.orgId === "string" ? obj.orgId.trim() : "";
  if (!orgId || !isUuid(orgId)) {
    return {
      ok: false,
      response: exportMutationValidationResponse({
        message: "orgId must be a valid organization UUID.",
        diagnosticId: "v10_export_org_id_invalid",
        field: "orgId",
        code: "invalid_uuid",
        userVisibleMessage: "Select a valid workspace before exporting.",
      }),
    };
  }

  let contractIdsParam = "";
  if (Array.isArray(obj.contractIds)) {
    const ids = obj.contractIds
      .filter((x): x is string => typeof x === "string" && isUuid(x))
      .slice(0, 200);
    contractIdsParam = ids.join(",");
  }

  const url = new URL("http://localhost/api/export/contracts");
  url.searchParams.set("orgId", orgId);
  if (contractIdsParam) {
    url.searchParams.set("contractIds", contractIdsParam);
  }

  const filt = obj.filter_json;
  const filterJsonExtension =
    typeof filt === "object" && filt !== null && !Array.isArray(filt)
      ? (filt as Record<string, unknown>)
      : undefined;

  return { ok: true, orgId, contractIdsParam, url, filterJsonExtension };
}

export function scheduleContractExportAsyncHandoff(
  input: Omit<
    ContractExportCsvInput,
    "admin" | "createExportJob" | "existingExportJobId"
  > & {
    queuedJobId: string;
    estimatedRowCount: number;
    completionAuditAction: "export_job.completed";
    recordAuditEvent: RecordAuditEvent;
  },
) {
  after(async () => {
    const backgroundAdmin = await createAdminClient();
    try {
      await executeContractExportCsv({
        admin: backgroundAdmin,
        userId: input.userId,
        orgId: input.orgId,
        selectedIds: input.selectedIds,
        exportScope: input.exportScope,
        filterJsonExtension: input.filterJsonExtension,
        existingExportJobId: input.queuedJobId,
        csvFieldNames: input.csvFieldNames,
        exportPlan: input.exportPlan,
        exportRowLimit: input.exportRowLimit,
      });
    } catch (error) {
      console.error("[export-contracts] async handoff failed:", error);
      const friendly =
        "Export failed unexpectedly. Retry from the export job view.";
      await backgroundAdmin
        .from("contract_export_jobs")
        .update({
          status: "failed",
          selected_contract_count: input.estimatedRowCount,
          exported_rows: 0,
          error_message: friendly,
          completed_at: new Date().toISOString(),
        })
        .eq("id", input.queuedJobId)
        .eq("organization_id", input.orgId);
      await emitProductTelemetryEvent(backgroundAdmin, {
        organizationId: input.orgId,
        userId: input.userId,
        action: "product.v9.export_failed",
        details: {
          scope: input.exportScope,
          reason: "async_handoff_failed",
          export_job_id: input.queuedJobId,
        },
      });
      await emitProductTelemetryEvent(backgroundAdmin, {
        organizationId: input.orgId,
        userId: input.userId,
        action: "product.v10.export_job_completed",
        details: {
          scope: input.exportScope,
          outcome: "failed_retryable",
          export_job_id: input.queuedJobId,
          async_handoff: true,
        },
      });
      await input.recordAuditEvent(backgroundAdmin, {
        organizationId: input.orgId,
        actorUserId: input.userId,
        action: input.completionAuditAction,
        targetType: "export_job",
        targetId: input.queuedJobId,
        outcome: "server_error",
        diagnosticId: "v10_export_async_handoff_failed",
        safeMetadata: {
          scope: input.exportScope,
          export_plan: input.exportPlan,
          row_limit: input.exportRowLimit,
          selected_row_count: input.estimatedRowCount,
          exported_row_count: 0,
          async_handoff: true,
        },
      });
      await refreshV10ReadModelsForOrganization(backgroundAdmin, input.orgId, {
        refreshScope: "one_model",
        reason: "contract_export_async_failed",
        modelKeys: [
          "job_run_visibility",
          "contract_activity_events",
          "audit_events",
        ],
      });
    }
  });
}
