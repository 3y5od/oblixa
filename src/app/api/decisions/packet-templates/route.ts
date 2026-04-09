import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isValidPacketType, packetTypeValidationError } from "@/lib/v5/packet-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function GET() {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .select("id, name, packet_type, template_json, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    name?: string;
    packetType?: string;
    template?: Record<string, unknown>;
  }>(raw, {});
  const name = toSafeString(body.name);
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const rawPt = toSafeString(body.packetType) || "renewal_packet";
  if (!isValidPacketType(rawPt)) {
    return NextResponse.json({ error: packetTypeValidationError() }, { status: 400 });
  }
  const packetType = rawPt;
  const templateJson = body.template && typeof body.template === "object" ? body.template : {};

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .insert({
      organization_id: ctx.orgId,
      name,
      packet_type: packetType,
      template_json: templateJson,
      created_by: ctx.userId,
    })
    .select("id, name, packet_type, template_json, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ template: data }, { status: 201 });
}
