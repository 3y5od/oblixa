import { NextResponse } from "next/server";
import { nowIso, signExternalSubmitTicket } from "@/lib/v5/api";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { recordMissedExternalDeadlineFinding } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-status:${ip}`, RATE_LIMITS.externalTokenRead);
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
  const { data, error } = await admin
    .from("external_action_links")
    .select(
      "id, organization_id, action_type, status, expires_at, requires_reauth, submitted_at, passcode_hash, scope_json"
    )
    .eq("token", token)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "External action not found" }, { status: 404 });

  if (isFeatureEnabled("v6AssuranceCore") && data.organization_id) {
    await incrementV6QualityCounter(
      admin,
      String(data.organization_id),
      "external_public_status_polls_total",
      1
    ).catch(() => undefined);
  }

  const expired = data.expires_at && data.expires_at < nowIso();
  const effectiveStatus = expired && data.status === "open" ? "expired" : data.status;

  if (
    isFeatureEnabled("v6AssuranceCore") &&
    expired &&
    data.status === "open" &&
    data.organization_id
  ) {
    await recordMissedExternalDeadlineFinding(
      admin,
      String(data.organization_id),
      String(data.id),
      String(data.action_type)
    ).catch(() => undefined);
  }
  const { passcode_hash: _h, ...rest } = data;
  const scope = (data.scope_json as Record<string, unknown> | null) ?? {};
  const submitTicket =
    data.requires_reauth && effectiveStatus === "open" && !expired
      ? signExternalSubmitTicket({ linkId: data.id, urlToken: token })
      : undefined;
  return NextResponse.json({
    externalAction: {
      ...rest,
      requires_passcode: Boolean(_h),
      status: effectiveStatus,
      expired,
      workflow_chain: Array.isArray(scope.workflow_chain) ? scope.workflow_chain : [],
      workflow_deadline_iso:
        typeof scope.workflow_deadline_iso === "string" ? scope.workflow_deadline_iso : null,
      workflow_ack_required: Boolean(scope.workflow_ack_required),
      correction_message: typeof scope.correction_message === "string" ? scope.correction_message : null,
      submitTicket,
      reauth_instructions:
        data.requires_reauth && effectiveStatus === "open" && !expired
          ? "Call GET status before each submit; include submitTicket from this response in your POST body."
          : undefined,
    },
  });
}

