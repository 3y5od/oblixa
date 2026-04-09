import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isValidPacketType, packetTypeValidationError } from "@/lib/v5/packet-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .select("id, name, packet_type, template_json, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
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

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = toSafeString(body.name);
    if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    patch.name = n;
  }
  if (body.packetType !== undefined) {
    const pt = toSafeString(body.packetType);
    if (!pt || !isValidPacketType(pt)) {
      return NextResponse.json({ error: packetTypeValidationError() }, { status: 400 });
    }
    patch.packet_type = pt;
  }
  if (body.template !== undefined) {
    patch.template_json =
      body.template && typeof body.template === "object" ? body.template : {};
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("decision_packet_templates")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, name, packet_type, template_json, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { error } = await ctx.admin
    .from("decision_packet_templates")
    .delete()
    .eq("organization_id", ctx.orgId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
