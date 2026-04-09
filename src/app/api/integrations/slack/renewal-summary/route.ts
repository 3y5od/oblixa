import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { sendSlackRenewalDecisionSummary } from "@/lib/integrations/slack";

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    contractId?: string;
    outcome?: string;
    details?: string;
  };
  const contractId = String(payload.contractId ?? "").trim();
  const outcome = String(payload.outcome ?? "").trim();
  if (!contractId || !outcome) {
    return NextResponse.json({ error: "contractId and outcome are required" }, { status: 400 });
  }

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, title")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const res = await sendSlackRenewalDecisionSummary(ctx.admin, {
    organizationId: ctx.orgId,
    contractId: contract.id,
    contractTitle: contract.title ?? contract.id,
    outcome,
    details: payload.details ? String(payload.details) : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
