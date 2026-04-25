import { NextResponse } from "next/server";
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

type ExportCsvOptions = {
  /** Shallow-merged into contract_export_jobs.filter_json after contract_ids (client cannot override contract_ids). */
  filterJsonExtension?: Record<string, unknown>;
};

async function runExportContractsCsv(request: Request, options?: ExportCsvOptions): Promise<Response> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orgIdParam = new URL(request.url).searchParams.get("orgId")?.trim() ?? "";
  if (orgIdParam && !isUuid(orgIdParam)) {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    return NextResponse.json(
      { error: mapDataSourceError(membershipError.message) },
      { status: 500 }
    );
  }

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id).filter(Boolean))];

  if (orgIds.length === 0) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  let orgId: string;
  let memberRole: WorkspaceRole = "viewer";
  if (orgIdParam) {
    if (!orgIds.includes(orgIdParam)) {
      return NextResponse.json({ error: "Access denied for orgId" }, { status: 403 });
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
      { status: 400 }
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId,
    role: memberRole,
    apiPath: "/api/export/contracts",
  });
  if (modeGate) return modeGate;

  const v6Settings = await getV6OrgSettingsJson(admin, orgId);
  const csvFieldNames = getExportCsvExtractedFieldNamesForWorkspaceMode(v6Settings.workspace_mode);

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
        headers: { "Retry-After": String(retryAfterSec) },
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
  let exportJobId: string | null = null;

  try {
    const { data: exportJob } = await admin
      .from("contract_export_jobs")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        scope: exportScope,
        status: "processing",
        export_format: "csv",
        selected_contract_count: selectedIds.length,
        filter_json: {
          ...(options?.filterJsonExtension ?? {}),
          contract_ids: selectedIds,
        },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    exportJobId = exportJob?.id ?? null;
  } catch (error) {
    console.error("[export-contracts] could not create export job:", error);
  }

  await emitProductTelemetryEvent(admin, {
    organizationId: orgId,
    userId: user.id,
    action: "product.v9.export_started",
    details: {
      scope: exportScope,
      selected_contract_count: selectedIds.length,
      export_job_created: Boolean(exportJobId),
    },
  });

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
            maxRows: 20_000,
          }
        );

  if (error) {
    if (exportJobId) {
      await admin
        .from("contract_export_jobs")
        .update({
          status: "failed",
          error_message: "Could not load contracts for export.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", exportJobId);
    }
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        scope: exportScope,
        reason: "contracts_query_failed",
      },
    });
    return NextResponse.json(
      { error: mapDataSourceError(error.message) },
      { status: 500 }
    );
  }
  if (truncated) {
    const partialError = "Export exceeds row budget; narrow scope and retry.";
    if (exportJobId) {
      await admin
        .from("contract_export_jobs")
        .update({
          status: "partial",
          truncated: true,
          error_message: partialError,
          completed_at: new Date().toISOString(),
        })
        .eq("id", exportJobId);
    }
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_partially_completed",
      details: {
        scope: exportScope,
        reason: "row_budget_exceeded",
        export_job_id: exportJobId,
      },
    });
    return NextResponse.json(
      {
        error: partialError,
        kind: "row_budget_exceeded",
        partial: true,
      },
      { status: 413 }
    );
  }

  const ownerIds = [
    ...new Set(
      (contracts ?? [])
        .map((c) => c.owner_id)
        .filter((id): id is string => !!id)
    ),
  ];

  const ownerEmailById = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);
    for (const p of profiles ?? []) {
      if (p.email) ownerEmailById.set(p.id, p.email);
    }
  }

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
        exported_rows: contracts?.length ?? 0,
        truncated: false,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", exportJobId);
  }

  await emitProductTelemetryEvent(admin, {
    organizationId: orgId,
    userId: user.id,
    action: "product.v9.export_completed",
    details: {
      scope: exportScope,
      row_count: contracts?.length ?? 0,
    },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(exportJobId ? { "X-Export-Job-Id": exportJobId } : {}),
    },
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
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Use Content-Type: application/json with an object body for this export request." },
      { status: 400 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Could not read export settings: the body is not valid JSON." },
      { status: 400 }
    );
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: "The export request body must be a JSON object." }, { status: 400 });
  }

  const obj = raw as Record<string, unknown>;
  if ("filter_json" in obj) {
    const fj = obj.filter_json;
    if (fj !== undefined && (typeof fj !== "object" || fj === null || Array.isArray(fj))) {
      return NextResponse.json(
        { error: "filter_json must be a JSON object. Remove the field or send an empty object {}." },
        { status: 400 }
      );
    }
  }

  const orgId = typeof obj.orgId === "string" ? obj.orgId.trim() : "";
  if (!orgId || !isUuid(orgId)) {
    return NextResponse.json({ error: "orgId must be a valid organization UUID." }, { status: 400 });
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

  const forward = new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });

  return runExportContractsCsv(forward, filterJsonExtension ? { filterJsonExtension } : undefined);
}
