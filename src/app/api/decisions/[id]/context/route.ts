import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { buildDecisionExecutionContext } from "@/lib/v5/decision-context";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: decision, error } = await ctx.admin
    .from("decision_workspaces")
    .select("id, linked_contract_ids")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!decision) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  const context = await buildDecisionExecutionContext(
    ctx.admin,
    ctx.orgId,
    decision.linked_contract_ids
  );

  return NextResponse.json({ decisionId: id, context });
}
