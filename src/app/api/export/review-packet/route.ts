import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";

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

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const orgId = membership.organization_id;
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [exceptions, approvalsRes, renewalsRes] = await Promise.all([
    getContractsMissingCriticalFields(admin, orgId),
    admin
      .from("contract_approvals")
      .select("id, contract_id, approval_type, status, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("contract_renewal_checkpoints")
      .select("id, contract_id, label, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .gte("due_date", today)
      .lte("due_date", ninetyDaysOut),
  ]);

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
