/**
 * Inbound automation: call from a Slack slash command or workflow step (HTTP) with Bearer
 * INBOUND_AUTOMATION_TOKEN. Body: organizationId, contractId, title, optional details, assigneeId, dueDate.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { isIsoDateOnly, isUuid } from "@/lib/security/validation";

type SlackTaskPayload = {
  organizationId: string;
  contractId: string;
  externalMessageId?: string;
  title: string;
  details?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  teamKey?: string;
};

const EXTERNAL_MESSAGE_ID_RE = /^[a-zA-Z0-9._:@\-]{1,200}$/;
const TEAM_KEY_RE = /^[a-z0-9_-]{1,50}$/;

function isAuthorized(request: Request): boolean {
  const token = process.env.INBOUND_AUTOMATION_TOKEN?.trim();
  if (!token) return false;
  const auth = parseBearerToken(request.headers.get("authorization"));
  return !!auth && secureCompareUtf8(auth, token);
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`tasks-slack:${ip}`, RATE_LIMITS.tasksFromSlackInbound);
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

  const body = (await request.json().catch(() => null)) as SlackTaskPayload | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.organizationId || !body.contractId || !body.title?.trim()) {
    return NextResponse.json({ error: "organizationId, contractId, and title are required." }, { status: 400 });
  }
  if (!isUuid(body.organizationId) || !isUuid(body.contractId)) {
    return NextResponse.json(
      { error: "organizationId and contractId must be valid UUIDs" },
      { status: 400 }
    );
  }
  if (body.assigneeId && !isUuid(body.assigneeId)) {
    return NextResponse.json({ error: "assigneeId must be a valid UUID" }, { status: 400 });
  }
  if (body.dueDate && !isIsoDateOnly(body.dueDate)) {
    return NextResponse.json({ error: "dueDate must be ISO date (YYYY-MM-DD)" }, { status: 400 });
  }
  if (body.title.trim().length > 240) {
    return NextResponse.json({ error: "title must be 240 characters or fewer" }, { status: 400 });
  }
  if (body.details && body.details.length > 10_000) {
    return NextResponse.json({ error: "details must be 10000 characters or fewer" }, { status: 400 });
  }
  if (body.externalMessageId && !EXTERNAL_MESSAGE_ID_RE.test(body.externalMessageId.trim())) {
    return NextResponse.json(
      { error: "externalMessageId contains invalid characters or is too long" },
      { status: 400 }
    );
  }
  if (body.teamKey && !TEAM_KEY_RE.test(body.teamKey.trim())) {
    return NextResponse.json({ error: "teamKey contains invalid characters or is too long" }, { status: 400 });
  }
  if (body.priority && !["low", "medium", "high"].includes(body.priority)) {
    return NextResponse.json({ error: "priority must be one of low, medium, high" }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", body.contractId)
    .eq("organization_id", body.organizationId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "Contract not found in organization" }, { status: 400 });
  }
  if (body.externalMessageId?.trim()) {
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", body.contractId)
      .eq("created_via", "integration")
      .eq("team_key", "slack")
      .ilike("details", `%external_message_id:${body.externalMessageId.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      return NextResponse.json({ success: true, deduped: true, taskId: existing.data.id });
    }
  }
  const { data: task, error } = await admin
    .from("contract_tasks")
    .insert({
      organization_id: body.organizationId,
      contract_id: body.contractId,
      title: body.title.trim(),
      details:
        [body.details?.trim() || null, body.externalMessageId?.trim() ? `external_message_id:${body.externalMessageId.trim()}` : null]
          .filter(Boolean)
          .join("\n") || null,
      assignee_id: body.assigneeId || null,
      due_date: body.dueDate?.trim() || null,
      priority: body.priority ?? "medium",
      status: "open",
      created_via: "integration",
      team_key: body.teamKey?.trim() || "slack",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("contract_task_events").insert({
    organization_id: body.organizationId,
    contract_id: body.contractId,
    task_id: task.id,
    actor_id: null,
    event_type: "created",
    details: { created_via: "integration", source: "slack", external_message_id: body.externalMessageId ?? null },
  });

  return NextResponse.json({ success: true, taskId: task.id });
}
