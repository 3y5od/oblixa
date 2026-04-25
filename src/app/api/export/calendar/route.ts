import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/export/calendar",
  });
  if (modeGate) return modeGate;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`export-calendar:${user.id}:${ip}`, RATE_LIMITS.exportCalendar);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const url = new URL(request.url);
  const role = String(url.searchParams.get("role") ?? "").trim().toLowerCase();
  const includeReminders = url.searchParams.get("includeReminders") !== "0";
  const includeObligations = url.searchParams.get("includeObligations") !== "0";
  const includeRenewalCheckpoints = url.searchParams.get("includeRenewalCheckpoints") !== "0";
  const includeRenewalDecisions = url.searchParams.get("includeRenewalDecisions") !== "0";
  const roleDefaults = {
    includeReminders,
    includeObligations,
    includeRenewalCheckpoints,
    includeRenewalDecisions: includeRenewalDecisions || role === "finance" || role === "manager",
  };

  await emitProductTelemetryEvent(admin, {
    organizationId: membership.organization_id,
    userId: user.id,
    action: "product.v9.export_started",
    details: {
      export_type: "calendar_ics",
      include_reminders: roleDefaults.includeReminders,
      include_obligations: roleDefaults.includeObligations,
      include_renewal_checkpoints: roleDefaults.includeRenewalCheckpoints,
      include_renewal_decisions: roleDefaults.includeRenewalDecisions,
      role: role || "default",
    },
  });

  try {
    const body = await buildOrganizationCalendarIcs(admin, membership.organization_id, roleDefaults);

    await emitProductTelemetryEvent(admin, {
      organizationId: membership.organization_id,
      userId: user.id,
      action: "product.v9.export_completed",
      details: {
        export_type: "calendar_ics",
        include_reminders: roleDefaults.includeReminders,
        include_obligations: roleDefaults.includeObligations,
        include_renewal_checkpoints: roleDefaults.includeRenewalCheckpoints,
        include_renewal_decisions: roleDefaults.includeRenewalDecisions,
      },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="oblixa-calendar.ics"',
      },
    });
  } catch (error) {
    console.error("[export/calendar] could not build calendar export:", error);
    await emitProductTelemetryEvent(admin, {
      organizationId: membership.organization_id,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        export_type: "calendar_ics",
        reason: "calendar_build_failed",
      },
    });
    return NextResponse.json(
      { error: "Could not build calendar export." },
      { status: 500 }
    );
  }
}
