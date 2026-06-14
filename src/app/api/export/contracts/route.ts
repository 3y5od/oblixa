import { NextResponse } from "next/server";
import {
  jsonForbidden,
  jsonRateLimited,
  jsonUnauthorized,
} from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import {
  exportJobCreateFailureResponse,
  exportMutationValidationResponse,
  exportProblem,
  parseExportContractsPostBody,
  scheduleContractExportAsyncHandoff,
  validateExportContractsPostHeaders,
} from "@/lib/export/contracts-route-helpers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import { getExportCsvExtractedFieldNamesForWorkspaceMode } from "@/lib/export-contract-csv-field-policy";
import { isUuid } from "@/lib/security/validation";
import type { WorkspaceRole } from "@/lib/navigation";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import {
  isKillImportExport,
  killSwitchJsonResponse,
} from "@/lib/security/kill-switches";
import {
  executeV10IdempotentResponseMutation,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
} from "@/lib/mutation-envelope";
import {
  getV10ContractExportRowLimit,
  isV10AsyncReportOrExportRequired,
  resolveV10ReportExportPlan,
} from "@/lib/report-export";
import {
  createContractExportJob,
  executeContractExportCsv,
} from "@/lib/export/contracts-csv";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const ROUTE = "/api/export/contracts";
type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type ExportCsvOptions = {
  /** Shallow-merged into contract_export_jobs.filter_json after contract_ids (client cannot override contract_ids). */
  filterJsonExtension?: Record<string, unknown>;
  createExportJob?: boolean;
  existingExportJobId?: string | null;
};

async function countContractsForAsyncHandoff(
  admin: AdminClient,
  orgId: string,
  selectedIds: string[],
): Promise<number> {
  if (selectedIds.length > 0) return selectedIds.length;
  const { count, error } = await admin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function runExportContractsCsv(
  request: Request,
  options?: ExportCsvOptions,
): Promise<Response> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonUnauthorized(ROUTE);
  }

  const orgIdParam =
    new URL(request.url).searchParams.get("orgId")?.trim() ?? "";
  if (orgIdParam && !isUuid(orgIdParam)) {
    return exportProblem(
      400,
      "Invalid orgId",
      "invalid_org_id",
      "export_contracts_org_id_invalid",
    );
  }

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    return exportProblem(
      500,
      mapDataSourceError(membershipError.message),
      "membership_load_failed",
      "export_contracts_membership_load_failed",
    );
  }

  const orgIds = [
    ...new Set(
      (memberships ?? []).map((m) => m.organization_id).filter(Boolean),
    ),
  ];

  if (orgIds.length === 0) {
    return exportProblem(
      400,
      "No organization",
      "organization_missing",
      "export_contracts_organization_missing",
    );
  }

  let orgId: string;
  let memberRole: WorkspaceRole = "viewer";
  if (orgIdParam) {
    if (!orgIds.includes(orgIdParam)) {
      return jsonForbidden(ROUTE);
    }
    orgId = orgIdParam;
    const row = (memberships ?? []).find(
      (m) => m.organization_id === orgIdParam,
    );
    if (row?.role) memberRole = row.role as WorkspaceRole;
  } else if (orgIds.length === 1) {
    orgId = orgIds[0];
    const row = (memberships ?? []).find((m) => m.organization_id === orgId);
    if (row?.role) memberRole = row.role as WorkspaceRole;
  } else {
    return exportProblem(
      400,
      "Multiple organizations found. Include ?orgId=<organization-id> to export a specific organization.",
      "org_id_required",
      "export_contracts_org_id_required",
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId,
    role: memberRole,
    apiPath: "/api/export/contracts",
    v10MutationResponse: options?.createExportJob === true,
  });
  if (modeGate) return modeGate;
  if (isKillImportExport()) return killSwitchJsonResponse("import_export");

  const v6Settings = await getOrgSettingsJson(admin, orgId);
  const csvFieldNames = getExportCsvExtractedFieldNamesForWorkspaceMode(
    v6Settings.workspace_mode,
  );
  const exportPlan = resolveV10ReportExportPlan(v6Settings);
  const exportRowLimit = getV10ContractExportRowLimit(exportPlan);

  const ip = getClientIpFromRequest(request);
  // prettier-ignore
  const rl = await rateLimitCheck(`export-contracts:${user.id}:${ip}`, RATE_LIMITS.exportContractsCsv);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const contractIdsParam =
    new URL(request.url).searchParams.get("contractIds")?.trim() ?? "";
  const selectedIds = contractIdsParam
    ? contractIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter((id) => isUuid(id))
        .slice(0, 200)
    : [];
  const exportScope = selectedIds.length > 0 ? "selected" : "workspace";
  const createExportJob = options?.createExportJob === true;
  return executeContractExportCsv({
    admin,
    userId: user.id,
    orgId,
    selectedIds,
    exportScope,
    filterJsonExtension: options?.filterJsonExtension,
    createExportJob,
    existingExportJobId: options?.existingExportJobId,
    csvFieldNames,
    exportPlan,
    exportRowLimit,
  });
}

export async function GET(request: Request) {
  return runExportContractsCsv(request);
}

/**
 * JSON alternative to GET /api/export/contracts?orgId=&contractIds= for clients that send filter metadata.
 * Malformed JSON or non-object `filter_json` returns 400 (never 500 from parse).
 */
export async function POST(request: Request) {
  const idempotencyKey = getV10IdempotencyKeyFromRequest(request);
  const headerRejection = validateExportContractsPostHeaders(
    request,
    idempotencyKey,
  );
  if (headerRejection) return headerRejection;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const response = buildV10MutationResponse({
      outcome: "unauthorized",
      message: "Not authenticated.",
      diagnosticId: "v10_export_unauthorized",
      nextDestinationHref: "/login",
    });
    return NextResponse.json(
      response,
      buildV10MutationResponseInit(response, {
        headers: PRIVATE_NO_STORE_HEADERS,
      }),
    );
  }

  const _limRaw = await readJsonBodyLimited(request);
  if (!_limRaw.ok) {
    return exportMutationValidationResponse({
      message:
        "Could not read export settings: the body is not valid JSON or is too large.",
      diagnosticId: "v10_export_json_invalid",
      field: "body",
      code: "invalid_json",
      userVisibleMessage: "Fix the JSON body and retry.",
    });
  }
  const parsedBody = parseExportContractsPostBody(_limRaw.body);
  if (!parsedBody.ok) return parsedBody.response;
  const { orgId, contractIdsParam, url, filterJsonExtension } = parsedBody;

  const admin = await createAdminClient();

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (membershipError) {
    return exportProblem(
      500,
      mapDataSourceError(membershipError.message),
      "membership_load_failed",
      "export_contracts_post_membership_load_failed",
    );
  }
  const member = (memberships ?? []).find(
    (row) => row.organization_id === orgId,
  );
  if (!member) {
    return jsonForbidden(ROUTE);
  }
  const memberRole = (member.role as WorkspaceRole | undefined) ?? "viewer";
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId,
    role: memberRole,
    apiPath: "/api/export/contracts",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;

  const v6Settings = await getOrgSettingsJson(admin, orgId);
  const csvFieldNames = getExportCsvExtractedFieldNamesForWorkspaceMode(
    v6Settings.workspace_mode,
  );
  const exportPlan = resolveV10ReportExportPlan(v6Settings);
  const exportRowLimit = getV10ContractExportRowLimit(exportPlan);
  const selectedIds = contractIdsParam
    ? contractIdsParam.split(",").filter(Boolean)
    : [];
  const exportScope = selectedIds.length > 0 ? "selected" : "workspace";

  let estimatedRowCount = 0;
  try {
    estimatedRowCount = await countContractsForAsyncHandoff(
      admin,
      orgId,
      selectedIds,
    );
  } catch (error) {
    return exportProblem(
      500,
      mapDataSourceError(
        error instanceof Error
          ? error.message
          : "Could not count contracts for export.",
      ),
      "export_count_failed",
      "export_contracts_count_failed",
    );
  }

  if (isV10AsyncReportOrExportRequired({ rowCount: estimatedRowCount })) {
    const { response } = await executeV10IdempotentResponseMutation(
      admin,
      {
        organizationId: orgId,
        actorUserId: user.id,
        mutationName: "create_export_job",
        targetType: "export_job",
        targetId: orgId,
        idempotencyKey,
        payload: {
          org_id: orgId,
          contract_ids: contractIdsParam,
          filter_json: filterJsonExtension ?? null,
          async_handoff: true,
          estimated_row_count: estimatedRowCount,
        },
      },
      async () => {
        const created = await createContractExportJob({
          admin,
          orgId,
          userId: user.id,
          exportScope,
          selectedIds,
          filterJsonExtension,
          exportPlan,
          exportRowLimit,
          initialStatus: "queued",
        });

        await emitProductTelemetryEvent(admin, {
          organizationId: orgId,
          userId: user.id,
          action: "product.v9.export_started",
          details: {
            scope: exportScope,
            selected_contract_count: estimatedRowCount,
            export_job_created: Boolean(created.jobId),
            async_handoff: true,
          },
        });

        if (!created.jobId) {
          return exportJobCreateFailureResponse();
        }
        const queuedJobId = created.jobId;

        await refreshV10ReadModelsForOrganization(admin, orgId, {
          refreshScope: "one_model",
          reason: "contract_export_queued",
          modelKeys: [
            "job_run_visibility",
            "contract_activity_events",
            "audit_events",
          ],
        });

        scheduleContractExportAsyncHandoff({
          userId: user.id,
          orgId,
          selectedIds,
          exportScope,
          filterJsonExtension,
          queuedJobId,
          estimatedRowCount,
          csvFieldNames,
          exportPlan,
          exportRowLimit,
          completionAuditAction: "export_job.completed",
          recordAuditEvent: recordV10AuditEvent,
        });

        const mutation = buildV10MutationResponse({
          outcome: created.auditEventId ? "success" : "audit_write_failed",
          message: "Export job created and queued.",
          changedObjectType: "export_job",
          changedObjectId: queuedJobId,
          newVersion: queuedJobId,
          nextDestinationHref: `/api/export/contracts/${queuedJobId}`,
          auditEventId: created.auditEventId,
          diagnosticId: created.auditEventId
            ? null
            : "v10_export_job_audit_missing",
          retryEligible: false,
        });
        return NextResponse.json(
          {
            success: true,
            jobId: queuedJobId,
            async: true,
            v10: mutation,
          },
          buildV10MutationResponseInit(mutation, {
            headers: PRIVATE_NO_STORE_HEADERS,
          }),
        );
      },
    );

    return response;
  }

  const forward = new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });

  const { response } = await executeV10IdempotentResponseMutation(
    admin,
    {
      organizationId: orgId,
      actorUserId: user.id,
      mutationName: "create_export_job",
      targetType: "export_job",
      targetId: orgId,
      idempotencyKey,
      payload: {
        org_id: orgId,
        contract_ids: contractIdsParam,
        filter_json: filterJsonExtension ?? null,
      },
    },
    () =>
      runExportContractsCsv(forward, {
        ...(filterJsonExtension ? { filterJsonExtension } : {}),
        createExportJob: true,
      }),
  );

  return response;
}
