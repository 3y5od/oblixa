import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { collectSupabaseRangePages } from "@/lib/supabase/range-pagination";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import { contentDispositionAttachment, sanitizeExportFileName } from "@/lib/security/export-filename";
import { recordV10AuditEvent } from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import {
  describeV10Truncation,
  resolveV10ReportExportPlan,
} from "@/lib/report-export";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";
import type { AdminClient } from "@/lib/assurance/service";

const ROUTE = "/api/export/contracts";
type ExportScope = "selected" | "workspace";

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

function exportProblem(status: number, error: string, code: string, diagnosticId: string, details?: Record<string, unknown>) {
  return jsonProblem(status, {
    error,
    code,
    diagnostic_id: diagnosticId,
    route: ROUTE,
    ...(details ? { details } : {}),
  });
}

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
      .eq("id", exportJobId)
      .eq("organization_id", orgId);
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
        .eq("id", exportJobId)
        .eq("organization_id", orgId);
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
    return exportProblem(500, mapDataSourceError(error.message), "contracts_query_failed", "export_contracts_query_failed");
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
        .eq("id", exportJobId)
        .eq("organization_id", orgId);
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
      await refreshV10ReadModelsForOrganization(admin, orgId, {
        refreshScope: "one_model",
        reason: "contract_export_completed",
        modelKeys: ["job_run_visibility", "report_run_visibility", "contract_activity_events", "audit_events"],
      });
    }
    return exportProblem(413, partialError, "row_budget_exceeded", "v10_export_row_budget_exceeded", {
      kind: "row_budget_exceeded",
      partial: true,
    });
  }

  const ownerIds = [
    ...new Set(
      (contracts ?? [])
        .map((c) => c.owner_id)
        .filter((id): id is string => Boolean(id))
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
  const filename = sanitizeExportFileName(`contracts-export-${new Date().toISOString().slice(0, 10)}.csv`);

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
      .eq("id", exportJobId)
      .eq("organization_id", orgId);
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
      "Content-Disposition": contentDispositionAttachment(filename),
      ...(exportJobId ? { "X-Export-Job-Id": exportJobId } : {}),
    },
  });
}
