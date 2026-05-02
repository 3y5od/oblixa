import { NextResponse } from "next/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { nowIso, readJsonBody, toSafeString, verifyExternalPasscode } from "@/lib/v5/api";
import { appendExternalWorkflowStep } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

/**
 * Token-authenticated workflow step append for external participants (V6 external collaboration).
 * Internal staff should continue to use POST /api/external-actions/[token]/workflow-step with session auth.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  if (!isFeatureEnabled("v6AssuranceCore")) {
    return NextResponse.json({ error: "Assurance workflows are disabled" }, { status: 403 });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-participant-workflow:${ip}`, RATE_LIMITS.externalTokenMutate);
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
  const { data: link, error: linkError } = await admin
    .from("external_action_links")
    .select("id, organization_id, status, expires_at, passcode_hash, scope_json")
    .eq("token", token)
    .maybeSingle();

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
  if (!link) return NextResponse.json({ error: "External action not found" }, { status: 404 });
  if (link.status !== "open") {
    return NextResponse.json({ error: "Link is not open" }, { status: 409 });
  }
  if (link.expires_at && link.expires_at < nowIso()) {
    return NextResponse.json({ error: "External action link expired" }, { status: 410 });
  }

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      stepType?: string;
      payload?: Record<string, unknown>;
      passcode?: string;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  if (!verifyExternalPasscode(body.passcode, link.passcode_hash ?? null)) {
    return NextResponse.json({ error: "Invalid or missing passcode" }, { status: 403 });
  }

  const stepType = toSafeString(body.stepType) || "participant_step";
  const result = await appendExternalWorkflowStep(
    admin,
    String(link.organization_id),
    String(link.id),
    stepType,
    body.payload ?? {},
    undefined
  );

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  await incrementV6QualityCounter(
    admin,
    String(link.organization_id),
    "external_workflow_step_appends_total",
    1
  ).catch(() => undefined);

  return NextResponse.json({ externalAction: result.data }, { status: 201 });
}
