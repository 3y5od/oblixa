import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { isUuid } from "@/lib/security/validation";

type EmailTaskPayload = {
  organizationId: string;
  contractId: string;
  externalMessageId?: string;
  subject: string;
  body?: string;
  from?: string;
  dueDate?: string;
};

function isAuthorized(request: Request): boolean {
  const token = process.env.INBOUND_AUTOMATION_TOKEN?.trim();
  if (!token) return false;
  const auth = parseBearerToken(request.headers.get("authorization"));
  return !!auth && secureCompareUtf8(auth, token);
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`tasks-email:${ip}`, { max: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | EmailTaskPayload
    | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload.organizationId || !payload.contractId || !payload.subject?.trim()) {
    return NextResponse.json(
      { error: "organizationId, contractId, and subject are required." },
      { status: 400 }
    );
  }
  if (!isUuid(payload.organizationId) || !isUuid(payload.contractId)) {
    return NextResponse.json(
      { error: "organizationId and contractId must be valid UUIDs" },
      { status: 400 }
    );
  }

  const title = `Email follow-up: ${payload.subject.trim()}`;
  const details = [
    payload.body?.trim(),
    payload.from ? `From: ${payload.from}` : null,
    payload.externalMessageId?.trim() ? `external_message_id:${payload.externalMessageId.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", payload.contractId)
    .eq("organization_id", payload.organizationId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "Contract not found in organization" }, { status: 400 });
  }
  if (payload.externalMessageId?.trim()) {
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", payload.contractId)
      .eq("created_via", "integration")
      .eq("team_key", "email")
      .ilike("details", `%external_message_id:${payload.externalMessageId.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      return NextResponse.json({ success: true, deduped: true, taskId: existing.data.id });
    }
  }
  const { data: task, error } = await admin
    .from("contract_tasks")
    .insert({
      organization_id: payload.organizationId,
      contract_id: payload.contractId,
      title,
      details: details || null,
      due_date: payload.dueDate || null,
      priority: "medium",
      status: "open",
      created_via: "integration",
      team_key: "email",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("contract_task_events").insert({
    organization_id: payload.organizationId,
    contract_id: payload.contractId,
    task_id: task.id,
    actor_id: null,
    event_type: "created",
    details: { created_via: "integration", source: "email", external_message_id: payload.externalMessageId ?? null },
  });
  return NextResponse.json({ success: true, taskId: task.id });
}
