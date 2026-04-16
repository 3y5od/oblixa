import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromHeaders,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

function csvEscape(value: string | null | undefined): string {
  if (!value) return "";
  if (/[,"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

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

  const [exceptions, approvalsRes, renewalsRes] = await Promise.all([
    getContractsMissingCriticalFields(admin, orgId),
    admin
      .from("contract_approvals")
      .select("id, contract_id, approval_type, status, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .limit(MAX_REVIEW_PACKET_ROWS),
    admin
      .from("contract_renewal_checkpoints")
      .select("id, contract_id, label, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .gte("due_date", today)
      .lte("due_date", ninetyDaysOut)
      .limit(MAX_REVIEW_PACKET_ROWS),
  ]);

  if (approvalsRes.error) {
    console.error("[export/review-packet] approvals:", approvalsRes.error.message);
    return NextResponse.json({ error: "Could not load approvals" }, { status: 500 });
  }
  if (renewalsRes.error) {
    console.error("[export/review-packet] renewals:", renewalsRes.error.message);
    return NextResponse.json({ error: "Could not load renewals" }, { status: 500 });
  }

  const lines = ["section,contract_id,contract_title,item,detail"];
  for (const c of exceptions) {
    lines.push(
      [
        "exceptions",
        csvEscape(c.id),
        csvEscape(c.title),
        "missing_critical_fields",
        csvEscape(c.counterparty ?? ""),
      ].join(",")
    );
  }
  for (const row of approvalsRes.data ?? []) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    lines.push(
      [
        "pending_approvals",
        csvEscape(contract?.id ?? row.contract_id),
        csvEscape(contract?.title ?? ""),
        csvEscape(row.approval_type),
        csvEscape(row.status),
      ].join(",")
    );
  }
  for (const row of renewalsRes.data ?? []) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    lines.push(
      [
        "renewals_90d",
        csvEscape(contract?.id ?? row.contract_id),
        csvEscape(contract?.title ?? ""),
        csvEscape(row.label),
        csvEscape(row.due_date),
      ].join(",")
    );
  }

  const csv = lines.join("\r\n");
  const fileName = `review-packet-${today}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
