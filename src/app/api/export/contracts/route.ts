import { after, NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { getExportCsvExtractedFieldNamesForWorkspaceMode } from "@/lib/export-contract-csv-field-policy";
import { isUuid } from "@/lib/security/validation";
import type { WorkspaceRole } from "@/lib/navigation";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { collectSupabaseRangePages } from "@/lib/supabase/range-pagination";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import {
  executeV10IdempotentResponseMutation,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { buildV10MutationResponse, buildV10MutationResponseInit, validateV10IdempotencyKey } from "@/lib/v10-mutation-envelope";
import {
  describeV10Truncation,
  getV10ContractExportRowLimit,
  isV10AsyncReportOrExportRequired,
  resolveV10ReportExportPlan,
} from "@/lib/v10-report-export";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type ExportScope = "selected" | "workspace";

function exportMutationValidationResponse(input: {
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
  return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
}

type ExportCsvOptions = {
  /** Shallow-merged into contract_export_jobs.filter_json after contract_ids (client cannot override contract_ids). */
  filterJsonExtension?: Record<string, unknown>;
  createExportJob?: boolean;
  existingExportJobId?: string | null;
};

type ExecuteContractExportCsvInput = {
  admin: AdminClient;
  userId: string;
  orgId: string;
  selectedIds: string[];
  exportScope: ExportScope;
  filterJsonExtension?: Record<string, unknown>;
  createExportJob?: boolean;
  existingExportJobId?: string | null;
  csvFieldNames: readonly string[];
  exportPlan: ReturnType<typeof resolveV10ReportExportPlan>;
  exportRowLimit: number;
};

async function resolveWorkspaceOwnerEmails(
  admin: AdminClient,
  orgId: string,
  ownerIds: string[]
): Promise<Map<string, string>> {
  if (ownerIds.length === 0) return new Map();

  const members = await loadOrgMemberProfileRows(admin, orgId, { userIds: ownerIds });

  return new Map(
    members.flatMap((member) => {
      const email = member.profiles?.email ?? null;
      return email ? [[member.user_id, email] as const] : [];
    })
  );
}

export async function createContractExportJob(input: {
  admin: AdminClient;
  orgId: string;
  userId: string;
  exportScope: ExportScope;
  selectedIds: string[];
  filterJsonExtension?: Record<string, unknown>;
  exportPlan: ReturnType<typeof resolveV10ReportExportPlan>;
  exportRowLimit: number;
  initialStatus?: "queued" | "processing";
}): Promise<{ jobId: string | null; auditEventId: string | null }> {
  try {
    const initialStatus = input.initialStatus ?? "processing";
    const startedAt = initialStatus === "queued" ? null : new Date().toISOString();
    const { data: exportJob } = await input.admin
      .from("contract_export_jobs")
      .insert({
        organization_id: input.orgId,
        created_by: input.userId,
        scope: input.exportScope,
        status: initialStatus,
        export_format: "csv",
        selected_contract_count: input.selectedIds.length,
        filter_json: {
          ...(input.filterJsonExtension ?? {}),
          export_plan: input.exportPlan,
          row_limit: input.exportRowLimit,
          async_handoff: initialStatus === "queued",
          contract_ids: input.selectedIds,
        },
        started_at: startedAt,
      })
      .select("id")
      .maybeSingle();
    const jobId = exportJob?.id ?? null;
    if (!jobId) return { jobId: null, auditEventId: null };

    const auditEventId = await recordV10AuditEvent(input.admin, {
      organizationId: input.orgId,
      actorUserId: input.userId,
      action: "export_job.created",
      targetType: "export_job",
      targetId: jobId,
      outcome: "success",
      safeMetadata: {
        scope: input.exportScope,
        export_plan: input.exportPlan,
        row_limit: input.exportRowLimit,
        selected_row_count: input.selectedIds.length,
        async_handoff: initialStatus === "queued",
      },
    });
    return { jobId, auditEventId };
  } catch (error) {
    console.error("[export-contracts] could not create export job:", error);
    return { jobId: null, auditEventId: null };
  }
}

async function countContractsForAsyncHandoff(admin: AdminClient, orgId: string, selectedIds: string[]): Promise<number> {
  if (selectedIds.length > 0) return selectedIds.length;
  const { count, error } = await admin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function executeContractExportCsv(input: ExecuteContractExportCsvInput): Promise<Response> {
  const {
    admin,
    userId,
    orgId,
    selectedIds,
    exportScope,
    filterJsonExtension,
    createExportJob = false,
    existingExportJobId = null,
    csvFieldNames,
    exportPlan,
    exportRowLimit,
  } = input;
  let exportJobId = existingExportJobId;

  if (exportJobId) {
    await admin
      .from("contract_export_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
      })
      .eq("id", exportJobId);
  }

  if (createExportJob) {
    const created = await createContractExportJob({
      admin,
      orgId,
      userId,
      exportScope,
      selectedIds,
      filterJsonExtension,
      exportPlan,
      exportRowLimit,
      initialStatus: "processing",
    });
    exportJobId = created.jobId;

    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId,
      action: "product.v9.export_started",
      details: {
        scope: exportScope,
        selected_contract_count: selectedIds.length,
        export_job_created: Boolean(exportJobId),
      },
    });
  }

  const {
    rows: contracts,
    error,
    truncated,
  } =
    selectedIds.length > 0
      ? await (async () => {
          const { data, error: selErr } = await admin
            .from("contracts")
            .select(
              "id, title, counterparty, contract_type, status, region, created_at, owner_id, extracted_fields(field_name, field_value, status)"
            )
            .eq("organization_id", orgId)
            .in("id", selectedIds)
            .order("created_at", { ascending: false });
          return {
            rows: data ?? [],
            error: selErr,
            truncated: false as const,
          };
        })()
      : await collectSupabaseRangePages(
          (from, to) =>
            admin
              .from("contracts")
              .select(
                "id, title, counterparty, contract_type, status, region, created_at, owner_id, extracted_fields(field_name, field_value, status)"
              )
              .eq("organization_id", orgId)
              .order("created_at", { ascending: false })
              .range(from, to),
          {
            pageSize: 500,
            maxRows: exportRowLimit,
          }
        );

  const selectedRowCount =
    selectedIds.length > 0
      ? selectedIds.length
      : truncated
        ? Math.max(exportRowLimit + 1, (contracts?.length ?? 0) + 1)
        : contracts?.length ?? 0;

  if (error) {
    if (exportJobId) {
      await admin
        .from("contract_export_jobs")
        .update({
          status: "failed",
          selected_contract_count: selectedRowCount,
          exported_rows: 0,
          error_message: "Could not load contracts for export.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", exportJobId);
    }
    if (exportJobId) {
      await emitProductTelemetryEvent(admin, {
        organizationId: orgId,
        userId,
        action: "product.v9.export_failed",
        details: {
          scope: exportScope,
          reason: "contracts_query_failed",
        },
      });
      await emitProductTelemetryEvent(admin, {
        organizationId: orgId,
        userId,
        action: "product.v10.export_job_completed",
        details: {
          scope: exportScope,
          outcome: "failed_retryable",
          export_job_created: Boolean(exportJobId),
        },
      });
    }
    if (exportJobId) {
      await recordV10AuditEvent(admin, {
        organizationId: orgId,
        actorUserId: userId,
        action: "export_job.completed",
        targetType: "export_job",
        targetId: exportJobId,
        outcome: "server_error",
        diagnosticId: "v10_export_contracts_query_failed",
        safeMetadata: {
          scope: exportScope,
          export_plan: exportPlan,
          row_limit: exportRowLimit,
          selected_row_count: selectedRowCount,
          exported_row_count: 0,
        },
      });
    }
    return NextResponse.json(
      { error: mapDataSourceError(error.message) },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  if (truncated) {
    const partialError =
      describeV10Truncation({
        selectedRowCount,
        exportedRowCount: contracts?.length ?? 0,
        reason: `Export exceeded the ${exportPlan} plan row limit of ${exportRowLimit}. Narrow scope and retry.`,
      }) ?? `Export exceeded the ${exportPlan} plan row limit of ${exportRowLimit}. Narrow scope and retry.`;
    if (exportJobId) {
      await admin
        .from("contract_export_jobs")
        .update({
          status: "partial",
          selected_contract_count: selectedRowCount,
          exported_rows: contracts?.length ?? 0,
          truncated: true,
          error_message: partialError,
          completed_at: new Date().toISOString(),
        })
        .eq("id", exportJobId);
    }
    if (exportJobId) {
      await emitProductTelemetryEvent(admin, {
        organizationId: orgId,
        userId,
        action: "product.v9.export_partially_completed",
        details: {
          scope: exportScope,
          reason: "row_budget_exceeded",
          export_job_id: exportJobId,
        },
      });
      await emitProductTelemetryEvent(admin, {
        organizationId: orgId,
        userId,
        action: "product.v10.export_job_completed",
        details: {
          scope: exportScope,
          outcome: "partial",
          export_job_id: exportJobId,
        },
      });
    }
    if (exportJobId) {
      await recordV10AuditEvent(admin, {
        organizationId: orgId,
        actorUserId: userId,
        action: "export_job.completed",
        targetType: "export_job",
        targetId: exportJobId,
        outcome: "dependency_blocked",
        diagnosticId: "v10_export_row_budget_exceeded",
        safeMetadata: {
          scope: exportScope,
          export_plan: exportPlan,
          row_limit: exportRowLimit,
          selected_row_count: selectedRowCount,
          exported_row_count: contracts?.length ?? 0,
          truncated: true,
          truncation_reason: partialError,
        },
      });
    }
    if (exportJobId) {
      await refreshV10ReadModelsForOrganization(admin, orgId, {
        refreshScope: "one_model",
        reason: "contract_export_completed",
        modelKeys: ["job_run_visibility", "report_run_visibility", "contract_activity_events", "audit_events"],
      });
    }
    return NextResponse.json(
      {
        error: partialError,
        kind: "row_budget_exceeded",
        partial: true,
      },
      { status: 413, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const ownerIds = [
    ...new Set(
      (contracts ?? [])
        .map((c) => c.owner_id)
        .filter((id): id is string => !!id)
    ),
  ];

  const ownerEmailById = await resolveWorkspaceOwnerEmails(admin, orgId, ownerIds);

  const header = [
    "id",
    "title",
    "counterparty",
    "contract_type",
    "status",
    "region",
    "owner_email",
    "created_at",
    ...csvFieldNames.map((f) => `field_${f}`),
    ...csvFieldNames.map((f) => `field_${f}_status`),
  ];

  const lines = [header.join(",")];

  for (const row of contracts ?? []) {
    const fields = (row.extracted_fields ?? []) as {
      field_name: string;
      field_value: string | null;
      status: string;
    }[];
    const byName = new Map(fields.map((f) => [f.field_name, f]));

    const ownerEmail = row.owner_id
      ? (ownerEmailById.get(row.owner_id) ?? "")
      : "";

    const base = [
      row.id,
      row.title,
      row.counterparty ?? "",
      row.contract_type ?? "",
      row.status,
      row.region ?? "",
      ownerEmail,
      row.created_at,
    ].map(escapeCsvCellForSpreadsheet);

    const values = csvFieldNames.map((name) =>
      escapeCsvCellForSpreadsheet(byName.get(name)?.field_value ?? "")
    );
    const statuses = csvFieldNames.map((name) =>
      escapeCsvCellForSpreadsheet(byName.get(name)?.status ?? "")
    );

    lines.push([...base, ...values, ...statuses].join(","));
  }

  const csv = lines.join("\r\n");
  const filename = `contracts-export-${new Date().toISOString().slice(0, 10)}.csv`;

  if (exportJobId) {
    await admin
      .from("contract_export_jobs")
      .update({
        status: "completed",
        selected_contract_count: selectedRowCount,
        exported_rows: contracts?.length ?? 0,
        truncated: false,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", exportJobId);
  }

  if (exportJobId) {
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId,
      action: "product.v9.export_completed",
      details: {
        scope: exportScope,
        row_count: contracts?.length ?? 0,
      },
    });
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId,
      action: "product.v10.export_job_completed",
      details: {
        scope: exportScope,
        outcome: "success",
        row_count: contracts?.length ?? 0,
        export_job_created: Boolean(exportJobId),
      },
    });
  }
  if (exportJobId) {
    await recordV10AuditEvent(admin, {
      organizationId: orgId,
      actorUserId: userId,
      action: "export_job.completed",
      targetType: "export_job",
      targetId: exportJobId,
      outcome: "success",
      safeMetadata: {
        scope: exportScope,
        export_plan: exportPlan,
        row_limit: exportRowLimit,
        selected_row_count: selectedRowCount,
        exported_row_count: contracts?.length ?? 0,
      },
    });
  }
  if (exportJobId) {
    await refreshV10ReadModelsForOrganization(admin, orgId, {
      refreshScope: "one_model",
      reason: "contract_export_completed",
      modelKeys: ["job_run_visibility", "report_run_visibility", "contract_activity_events", "audit_events"],
    });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(exportJobId ? { "X-Export-Job-Id": exportJobId } : {}),
    },
  });
}

async function runExportContractsCsv(request: Request, options?: ExportCsvOptions): Promise<Response> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const orgIdParam = new URL(request.url).searchParams.get("orgId")?.trim() ?? "";
  if (orgIdParam && !isUuid(orgIdParam)) {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    return NextResponse.json(
      { error: mapDataSourceError(membershipError.message) },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id).filter(Boolean))];

  if (orgIds.length === 0) {
    return NextResponse.json({ error: "No organization" }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  let orgId: string;
  let memberRole: WorkspaceRole = "viewer";
  if (orgIdParam) {
    if (!orgIds.includes(orgIdParam)) {
      return NextResponse.json({ error: "Access denied for orgId" }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    }
    orgId = orgIdParam;
    const row = (memberships ?? []).find((m) => m.organization_id === orgIdParam);
    if (row?.role) memberRole = row.role as WorkspaceRole;
  } else if (orgIds.length === 1) {
    orgId = orgIds[0];
    const row = (memberships ?? []).find((m) => m.organization_id === orgId);
    if (row?.role) memberRole = row.role as WorkspaceRole;
  } else {
    return NextResponse.json(
      {
        error:
          "Multiple organizations found. Include ?orgId=<organization-id> to export a specific organization.",
      },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
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

  const v6Settings = await getV6OrgSettingsJson(admin, orgId);
  const csvFieldNames = getExportCsvExtractedFieldNamesForWorkspaceMode(v6Settings.workspace_mode);
  const exportPlan = resolveV10ReportExportPlan(v6Settings);
  const exportRowLimit = getV10ContractExportRowLimit(exportPlan);

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`export-contracts:${user.id}:${ip}`, RATE_LIMITS.exportContractsCsv);
  if (!rl.ok) {
    const retryAfterSec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return NextResponse.json(
      {
        error: "Too many export requests — please wait before retrying.",
        kind: "rate_limited",
        retryAfterSec,
      },
      {
        status: 429,
        headers: { ...PRIVATE_NO_STORE_HEADERS, "Retry-After": String(retryAfterSec) },
      }
    );
  }

  const contractIdsParam = new URL(request.url).searchParams.get("contractIds")?.trim() ?? "";
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
  const contentType = request.headers.get("content-type") ?? "";
  const idempotencyKey = getV10IdempotencyKeyFromRequest(request);
  if (!idempotencyKey || !validateV10IdempotencyKey(idempotencyKey)) {
    return exportMutationValidationResponse({
      message: "A valid x-idempotency-key header is required for this V10 export mutation.",
      diagnosticId: "v10_export_idempotency_key_invalid",
      field: "x-idempotency-key",
      code: "invalid_format",
      userVisibleMessage: "Use a unique retry key for this export.",
    });
  }
  if (!contentType.includes("application/json")) {
    return exportMutationValidationResponse({
      message: "Use Content-Type: application/json with an object body for this export request.",
      diagnosticId: "v10_export_content_type_invalid",
      field: "content-type",
      code: "application_json_required",
      userVisibleMessage: "Send this export request as JSON.",
    });
  }

  const _limRaw = await readJsonBodyLimited(request);
  if (!_limRaw.ok) {
    return exportMutationValidationResponse({
      message: "Could not read export settings: the body is not valid JSON or is too large.",
      diagnosticId: "v10_export_json_invalid",
      field: "body",
      code: "invalid_json",
      userVisibleMessage: "Fix the JSON body and retry.",
    });
  }
  const raw = _limRaw.body;

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return exportMutationValidationResponse({
      message: "The export request body must be a JSON object.",
      diagnosticId: "v10_export_body_object_required",
      field: "body",
      code: "object_required",
      userVisibleMessage: "Send a JSON object for export settings.",
    });
  }

  const obj = raw as Record<string, unknown>;
  if ("filter_json" in obj) {
    const fj = obj.filter_json;
    if (fj !== undefined && (typeof fj !== "object" || fj === null || Array.isArray(fj))) {
      return exportMutationValidationResponse({
        message: "filter_json must be a JSON object. Remove the field or send an empty object {}.",
        diagnosticId: "v10_export_filter_json_invalid",
        field: "filter_json",
        code: "object_required",
        userVisibleMessage: "Remove filter_json or send an empty object.",
      });
    }
  }

  const orgId = typeof obj.orgId === "string" ? obj.orgId.trim() : "";
  if (!orgId || !isUuid(orgId)) {
    return exportMutationValidationResponse({
      message: "orgId must be a valid organization UUID.",
      diagnosticId: "v10_export_org_id_invalid",
      field: "orgId",
      code: "invalid_uuid",
      userVisibleMessage: "Select a valid workspace before exporting.",
    });
  }

  const supabase = await createClient();
  const admin = await createAdminClient();
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
    return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
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

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (membershipError) {
    return NextResponse.json(
      { error: mapDataSourceError(membershipError.message) },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  const member = (memberships ?? []).find((row) => row.organization_id === orgId);
  if (!member) {
    return NextResponse.json({ error: "Access denied for orgId" }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
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

  const v6Settings = await getV6OrgSettingsJson(admin, orgId);
  const csvFieldNames = getExportCsvExtractedFieldNamesForWorkspaceMode(v6Settings.workspace_mode);
  const exportPlan = resolveV10ReportExportPlan(v6Settings);
  const exportRowLimit = getV10ContractExportRowLimit(exportPlan);
  const selectedIds = contractIdsParam ? contractIdsParam.split(",").filter(Boolean) : [];
  const exportScope = selectedIds.length > 0 ? "selected" : "workspace";

  let estimatedRowCount = 0;
  try {
    estimatedRowCount = await countContractsForAsyncHandoff(admin, orgId, selectedIds);
  } catch (error) {
    return NextResponse.json(
      { error: mapDataSourceError(error instanceof Error ? error.message : "Could not count contracts for export.") },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
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
          const failure = buildV10MutationResponse({
            outcome: "server_error",
            message: "The export job could not be created.",
            changedObjectType: "export_job",
            changedObjectId: null,
            diagnosticId: "v10_export_job_create_failed",
          });
          return NextResponse.json(
            { error: failure.user_visible_message, v10: failure },
            buildV10MutationResponseInit(failure, { headers: PRIVATE_NO_STORE_HEADERS })
          );
        }
        const queuedJobId = created.jobId;

        await refreshV10ReadModelsForOrganization(admin, orgId, {
          refreshScope: "one_model",
          reason: "contract_export_queued",
          modelKeys: ["job_run_visibility", "contract_activity_events", "audit_events"],
        });

        after(async () => {
          const backgroundAdmin = await createAdminClient();
          try {
            await executeContractExportCsv({
              admin: backgroundAdmin,
              userId: user.id,
              orgId,
              selectedIds,
              exportScope,
              filterJsonExtension,
              existingExportJobId: queuedJobId,
              csvFieldNames,
              exportPlan,
              exportRowLimit,
            });
          } catch (error) {
            console.error("[export-contracts] async handoff failed:", error);
            const friendly = "Export failed unexpectedly. Retry from the export job view.";
            await backgroundAdmin
              .from("contract_export_jobs")
              .update({
                status: "failed",
                selected_contract_count: estimatedRowCount,
                exported_rows: 0,
                error_message: friendly,
                completed_at: new Date().toISOString(),
              })
              .eq("id", queuedJobId);
            await emitProductTelemetryEvent(backgroundAdmin, {
              organizationId: orgId,
              userId: user.id,
              action: "product.v9.export_failed",
              details: {
                scope: exportScope,
                reason: "async_handoff_failed",
                export_job_id: queuedJobId,
              },
            });
            await emitProductTelemetryEvent(backgroundAdmin, {
              organizationId: orgId,
              userId: user.id,
              action: "product.v10.export_job_completed",
              details: {
                scope: exportScope,
                outcome: "failed_retryable",
                export_job_id: queuedJobId,
                async_handoff: true,
              },
            });
            await recordV10AuditEvent(backgroundAdmin, {
              organizationId: orgId,
              actorUserId: user.id,
              action: "export_job.completed",
              targetType: "export_job",
              targetId: queuedJobId,
              outcome: "server_error",
              diagnosticId: "v10_export_async_handoff_failed",
              safeMetadata: {
                scope: exportScope,
                export_plan: exportPlan,
                row_limit: exportRowLimit,
                selected_row_count: estimatedRowCount,
                exported_row_count: 0,
                async_handoff: true,
              },
            });
            await refreshV10ReadModelsForOrganization(backgroundAdmin, orgId, {
              refreshScope: "one_model",
              reason: "contract_export_async_failed",
              modelKeys: ["job_run_visibility", "contract_activity_events", "audit_events"],
            });
          }
        });

        const mutation = buildV10MutationResponse({
          outcome: created.auditEventId ? "success" : "audit_write_failed",
          message: "Export job created and queued.",
          changedObjectType: "export_job",
          changedObjectId: queuedJobId,
          newVersion: queuedJobId,
          nextDestinationHref: `/api/export/contracts/${queuedJobId}`,
          auditEventId: created.auditEventId,
          diagnosticId: created.auditEventId ? null : "v10_export_job_audit_missing",
          retryEligible: false,
        });
        return NextResponse.json(
          {
            success: true,
            jobId: queuedJobId,
            async: true,
            v10: mutation,
          },
          buildV10MutationResponseInit(mutation, { headers: PRIVATE_NO_STORE_HEADERS })
        );
      }
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
    () => runExportContractsCsv(forward, {
      ...(filterJsonExtension ? { filterJsonExtension } : {}),
      createExportJob: true,
    })
  );

  return response;
}
