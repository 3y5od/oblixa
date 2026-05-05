import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromHeaders,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { collectSupabaseRangePages } from "@/lib/supabase/range-pagination";

export async function GET() {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const orgId = membership.organization_id;
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId,
    apiPath: "/api/export/review-packet",
  });
  if (modeGate) return modeGate;
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`export-review-packet:${user.id}:${ip}`, RATE_LIMITS.exportReviewPacket);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const MAX_REVIEW_PACKET_ROWS = 5000;

  await emitProductTelemetryEvent(admin, {
    organizationId: orgId,
    userId: user.id,
    action: "product.v9.export_started",
    details: {
      export_type: "review_packet",
      horizon_days: 90,
      max_rows: MAX_REVIEW_PACKET_ROWS,
    },
  });

  const [exceptions, approvalsRes, renewalsRes] = await Promise.all([
    getContractsMissingCriticalFields(admin, orgId),
    collectSupabaseRangePages(
      (from, to) =>
        admin
          .from("contract_approvals")
          .select("id, contract_id, approval_type, status, contracts!inner(id, title, organization_id)")
          .eq("organization_id", orgId)
          .eq("status", "pending")
          .range(from, to),
      { pageSize: 1000, maxRows: MAX_REVIEW_PACKET_ROWS }
    ),
    collectSupabaseRangePages(
      (from, to) =>
        admin
          .from("contract_renewal_checkpoints")
          .select("id, contract_id, label, due_date, contracts!inner(id, title, organization_id)")
          .eq("organization_id", orgId)
          .eq("status", "pending")
          .gte("due_date", today)
          .lte("due_date", ninetyDaysOut)
          .range(from, to),
      { pageSize: 1000, maxRows: MAX_REVIEW_PACKET_ROWS }
    ),
  ]);

  if (approvalsRes.error) {
    console.error("[export/review-packet] approvals:", approvalsRes.error.message);
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        export_type: "review_packet",
        reason: "approvals_query_failed",
      },
    });
    return NextResponse.json({ error: "Could not load approvals" }, { status: 500 });
  }
  if (renewalsRes.error) {
    console.error("[export/review-packet] renewals:", renewalsRes.error.message);
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        export_type: "review_packet",
        reason: "renewals_query_failed",
      },
    });
    return NextResponse.json({ error: "Could not load renewals" }, { status: 500 });
  }
  if (approvalsRes.truncated || renewalsRes.truncated) {
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_partially_completed",
      details: {
        export_type: "review_packet",
        reason: "row_budget_exceeded",
        approvals_truncated: approvalsRes.truncated,
        renewals_truncated: renewalsRes.truncated,
        max_rows: MAX_REVIEW_PACKET_ROWS,
      },
    });
    return NextResponse.json(
      {
        ok: false,
        error: `Review packet export exceeded the ${MAX_REVIEW_PACKET_ROWS} row budget. Narrow scope and retry.`,
        code: "row_budget_exceeded",
        diagnostic_id: "review_packet_row_budget_exceeded",
        partial: true,
      },
      { status: 413 }
    );
  }

  const approvals = approvalsRes.rows;
  const renewals = renewalsRes.rows;

  const lines = ["section,contract_id,contract_title,item,detail"];
  for (const c of exceptions) {
    lines.push(
      [
        "exceptions",
        escapeCsvCellForSpreadsheet(c.id),
        escapeCsvCellForSpreadsheet(c.title),
        "missing_critical_fields",
        escapeCsvCellForSpreadsheet(c.counterparty ?? ""),
      ].join(",")
    );
  }
  for (const row of approvals) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    lines.push(
      [
        "pending_approvals",
        escapeCsvCellForSpreadsheet(contract?.id ?? row.contract_id),
        escapeCsvCellForSpreadsheet(contract?.title ?? ""),
        escapeCsvCellForSpreadsheet(row.approval_type),
        escapeCsvCellForSpreadsheet(row.status),
      ].join(",")
    );
  }
  for (const row of renewals) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    lines.push(
      [
        "renewals_90d",
        escapeCsvCellForSpreadsheet(contract?.id ?? row.contract_id),
        escapeCsvCellForSpreadsheet(contract?.title ?? ""),
        escapeCsvCellForSpreadsheet(row.label),
        escapeCsvCellForSpreadsheet(row.due_date),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");
  const fileName = `review-packet-${today}.csv`;
  await emitProductTelemetryEvent(admin, {
    organizationId: orgId,
    userId: user.id,
    action: "product.v9.export_completed",
    details: {
      export_type: "review_packet",
      missing_critical_count: exceptions.length,
      pending_approvals_count: approvals.length,
      renewal_checkpoint_count: renewals.length,
    },
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
