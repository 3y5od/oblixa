import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { nowIso, verifyExternalPasscode, verifyExternalSubmitTicket } from "@/lib/v5/api";
import { validateExternalActionPayload } from "@/lib/v5/external-action-payload";
import {
  type ExternalActionType,
  isValidExternalActionType,
} from "@/lib/v5/external-action-types";
import {
  appendAccountTimelineEvent,
  appendCounterpartyTimelineEvent,
} from "@/lib/v5/relationship-timeline";
import { appendExternalWorkflowStep } from "@/lib/v6/external-collaboration";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-submit:${ip}`, RATE_LIMITS.externalTokenMutate);
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
  const { token } = await params;
  const admin = await createAdminClient();
  const _lb_rawPayload = await readJsonBodyLimited(request);
  if (!_lb_rawPayload.ok) return _lb_rawPayload.response;
  const rawPayload = (_lb_rawPayload.body ?? {}) as Record<string, unknown>;
  const passcode = typeof rawPayload.passcode === "string" ? rawPayload.passcode : undefined;
  const submitTicket =
    typeof rawPayload.submitTicket === "string" ? rawPayload.submitTicket : undefined;

  const { data: link, error: linkError } = await admin
    .from("external_action_links")
    .select(
      "id, organization_id, status, expires_at, one_time, action_type, scope_json, passcode_hash, decision_workspace_id, requires_reauth"
    )
    .eq("token", token)
    .maybeSingle();
  if (linkError) {
    console.error("[api/external-actions/submit] link query error:", linkError.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 400 });
  }
  if (!link) return NextResponse.json({ error: "External action not found" }, { status: 404 });

  if (link.requires_reauth) {
    const ticketCheck = verifyExternalSubmitTicket(token, submitTicket, String(link.id));
    if (!ticketCheck.ok) {
      return NextResponse.json(
        {
          error:
            ticketCheck.reason === "submit_ticket_required"
              ? "This link requires a fresh status check before submit. Load the page or call GET status, then try again."
              : "Invalid or expired submit ticket. Refresh the page to obtain a new ticket.",
          code: ticketCheck.reason,
        },
        { status: 403 }
      );
    }
  }

  if (!verifyExternalPasscode(passcode, link.passcode_hash ?? null)) {
    return NextResponse.json({ error: "Invalid or missing passcode" }, { status: 403 });
  }

  if (link.expires_at < nowIso()) {
    await admin
      .from("external_action_links")
      .update({ status: "expired" })
      .eq("id", link.id)
      .eq("organization_id", link.organization_id);
    return NextResponse.json({ error: "External action link expired" }, { status: 410 });
  }
  if (link.status === "submitted") {
    return NextResponse.json({ error: "External action already submitted" }, { status: 409 });
  }

  const bodyForValidation = { ...rawPayload };
  delete bodyForValidation.passcode;
  delete bodyForValidation.submitTicket;

  const at = String(link.action_type);
  if (!isValidExternalActionType(at)) {
    return NextResponse.json({ error: "Invalid action type on link" }, { status: 400 });
  }
  const validated = validateExternalActionPayload(at as ExternalActionType, bodyForValidation);
  if (!validated.ok) {
    if (isFeatureEnabled("v6AssuranceCore")) {
      const prevScope = (link.scope_json as Record<string, unknown> | null) ?? {};
      await admin
        .from("external_action_links")
        .update({
          scope_json: {
            ...prevScope,
            correction_message: validated.error,
            correction_at: nowIso(),
            workflow_version: 2,
          },
        })
        .eq("id", link.id)
        .eq("organization_id", link.organization_id);
    }
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const storePayload = validated.normalized;

  const submittedAt = nowIso();
  const { data, error } = await admin
    .from("external_action_links")
    .update({
      status: "submitted",
      submitted_payload_json: storePayload,
      submitted_at: submittedAt,
    })
    .eq("id", link.id)
    .eq("organization_id", link.organization_id)
    .neq("status", "submitted")
    .select("id, status, submitted_at")
    .maybeSingle();
  if (error) {
    console.error("[api/external-actions/submit] update error:", error.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "External action already submitted" }, { status: 409 });
  }

  await admin.from("external_action_events").insert({
    organization_id: link.organization_id,
    external_action_link_id: link.id,
    event_type: "external.submitted",
    payload_json: {
      submitted_keys: Object.keys(storePayload),
      workflow_chain_length: Array.isArray((link.scope_json as Record<string, unknown> | null)?.workflow_chain)
        ? ((link.scope_json as Record<string, unknown>).workflow_chain as unknown[]).length
        : 0,
    },
  });

  await appendExternalWorkflowStep(
    admin,
    link.organization_id,
    String(link.id),
    "submission_received",
    {
      submitted_at: submittedAt,
      submitted_keys: Object.keys(storePayload),
    }
  );

  const scope = link.scope_json as Record<string, unknown> | null;
  const reqRaw = scope?.evidenceRequirementId;
  const requirementId = typeof reqRaw === "string" && UUID_RE.test(reqRaw) ? reqRaw : null;
  const wantsEvidence =
    /evidence/i.test(String(link.action_type)) || requirementId !== null;
  if (requirementId && wantsEvidence) {
    const { data: reqRow } = await admin
      .from("evidence_requirements")
      .select("id")
      .eq("organization_id", link.organization_id)
      .eq("id", requirementId)
      .maybeSingle();
    if (reqRow) {
      await admin.from("evidence_submissions").insert({
        organization_id: link.organization_id,
        requirement_id: requirementId,
        submitted_by: null,
        payload_json: storePayload,
        external_action_link_id: link.id,
      });
    }
  }

  if (isFeatureEnabled("v5RelationshipLayer") && link.decision_workspace_id) {
    const { data: dec } = await admin
      .from("decision_workspaces")
      .select("linked_account_key, linked_counterparty_key, title")
      .eq("organization_id", link.organization_id)
      .eq("id", link.decision_workspace_id)
      .maybeSingle();
    if (dec) {
      const p = {
        external_action_link_id: link.id,
        action_type: link.action_type,
        decision_workspace_id: link.decision_workspace_id,
        title: dec.title,
      };
      if (dec.linked_account_key) {
        await appendAccountTimelineEvent(
          admin,
          link.organization_id,
          dec.linked_account_key,
          "relationship.external_submitted",
          p
        );
      }
      if (dec.linked_counterparty_key) {
        await appendCounterpartyTimelineEvent(
          admin,
          link.organization_id,
          dec.linked_counterparty_key,
          "relationship.external_submitted",
          p
        );
      }
    }
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(
      admin,
      String(link.organization_id),
      "external_collaboration_submissions_total",
      1
    ).catch(() => undefined);
    await runIncrementalAssuranceChecks(admin, String(link.organization_id), null).catch(() => undefined);
  }

  return NextResponse.json({ submission: data });
}
