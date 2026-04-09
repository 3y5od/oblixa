import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("operational_recommendations")
    .select(
      "id, recommendation_type, priority, target_ref_type, target_ref_id, recommendation_text, reason_json, confidence, accepted, dismissed, generated_at, expires_at"
    )
    .eq("organization_id", ctx.orgId)
    .order("generated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const recommendations = (data ?? []).map((row) => {
    const rawReason = row.reason_json;
    const reason_json =
      Array.isArray(rawReason) && rawReason.length > 0
        ? rawReason
        : [{ signal: "unspecified", value: "missing_or_invalid_reason_json" }];
    const target_ref_type = row.target_ref_type ?? null;
    const target_ref_id = row.target_ref_id ?? null;
    const target_refs =
      target_ref_type && target_ref_id
        ? [{ ref_type: target_ref_type, ref_id: String(target_ref_id) }]
        : [];
    const explainability_valid = reason_json.length > 0 && target_refs.length > 0;
    return {
      ...row,
      reason_json,
      target_ref_type,
      target_ref_id,
      target_refs,
      explainability_valid,
    };
  });
  return NextResponse.json({ recommendations });
}

