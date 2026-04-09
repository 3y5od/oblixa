import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, title")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const [{ data: requirements }, { data: attestationRequests }] = await Promise.all([
    ctx.admin
      .from("evidence_requirements")
      .select(
        "id, work_item_type, work_item_id, requirement_type, title, required, due_at, review_due_at, status, config_json, created_at, updated_at"
      )
      .eq("organization_id", ctx.orgId)
      .eq("contract_id", contractId),
    ctx.admin
      .from("attestation_requests")
      .select(
        "id, request_type, title, details, status, due_at, owner_id, reviewer_id, created_at, updated_at"
      )
      .eq("organization_id", ctx.orgId)
      .eq("contract_id", contractId),
  ]);

  const reqIds = (requirements ?? []).map((r) => r.id);
  const { data: submissions } =
    reqIds.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await ctx.admin
          .from("evidence_submissions")
          .select(
            "id, requirement_id, submitted_by, submitted_at, status, payload_json, reviewer_id, reviewed_at, rejection_reason"
          )
          .eq("organization_id", ctx.orgId)
          .in("requirement_id", reqIds);

  const attIds = (attestationRequests ?? []).map((a) => a.id);
  const { data: attestationResponses } =
    attIds.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await ctx.admin
          .from("attestation_responses")
          .select("id, request_id, responder_id, response_type, response_note, payload_json, responded_at")
          .eq("organization_id", ctx.orgId)
          .in("request_id", attIds);

  const templatesResult = await ctx.admin
    .from("evidence_requirement_templates")
    .select("id, name, requirement_type, template_json, created_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  const templates = templatesResult.error ? [] : templatesResult.data ?? [];

  const pack = {
    schema: "oblixa.evidence_pack.v1",
    exported_at: new Date().toISOString(),
    contract: { id: contract.id, title: contract.title },
    evidence_requirements: requirements ?? [],
    evidence_submissions: submissions ?? [],
    attestation_requests: attestationRequests ?? [],
    attestation_responses: attestationResponses ?? [],
    templates_snapshot: templates,
  };

  const body = JSON.stringify(pack, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="evidence-pack-${contractId}.json"`,
      "cache-control": "no-store",
    },
  });
}
