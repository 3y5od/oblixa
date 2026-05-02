import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/attestations/[id]/respond",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    responseType?: "confirm" | "reject" | "needs_follow_up";
    note?: string;
    payload?: Record<string, unknown>;
  };
  const responseType = body.responseType ?? "confirm";

  const { data: reqRow } = await ctx.admin
    .from("attestation_requests")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!reqRow) return NextResponse.json({ error: "Attestation request not found" }, { status: 404 });
  if (!["open", "overdue"].includes(reqRow.status)) {
    return NextResponse.json(
      { error: `Cannot respond to an attestation request with status "${reqRow.status}"` },
      { status: 409 }
    );
  }

  const { error } = await ctx.admin.from("attestation_responses").insert({
    organization_id: ctx.orgId,
    request_id: id,
    responder_id: ctx.userId,
    response_type: responseType,
    response_note: body.note?.trim() || null,
    payload_json: body.payload ?? {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin
    .from("attestation_requests")
    .update({ status: responseType === "reject" ? "rejected" : "responded" })
    .eq("id", id)
    .eq("organization_id", ctx.orgId);

  return NextResponse.json({ ok: true });
}
