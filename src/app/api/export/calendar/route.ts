import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { recordV10AuditEvent } from "@/lib/server-contracts";
import { contentDispositionAttachment, sanitizeExportFileName } from "@/lib/security/export-filename";
import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";
import { parseBooleanParam, parseFixedEnumParam } from "@/lib/security/validation";

const ROUTE = "/api/export/calendar";
const CALENDAR_EXPORT_ROLES = ["", "finance", "manager"] as const;

function invalidBooleanQueryParam(param: string) {
  return jsonProblem(400, {
    error: "Boolean query parameters must be true, false, 1, or 0.",
    code: "invalid_boolean_query",
    diagnostic_id: "calendar_export_boolean_query_invalid",
    route: ROUTE,
    details: { param },
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonUnauthorized(ROUTE);
  }

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(400, {
      error: "No organization found",
      code: "organization_not_found",
      diagnostic_id: "calendar_export_organization_not_found",
      route: ROUTE,
    });
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
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const url = new URL(request.url);
  const role = parseFixedEnumParam(url.searchParams.get("role")?.trim().toLowerCase(), CALENDAR_EXPORT_ROLES, "");
  const includeReminders = parseBooleanParam(url.searchParams.get("includeReminders"), { defaultValue: true });
  const includeObligations = parseBooleanParam(url.searchParams.get("includeObligations"), { defaultValue: true });
  const includeRenewalCheckpoints = parseBooleanParam(url.searchParams.get("includeRenewalCheckpoints"), {
    defaultValue: true,
  });
  const includeRenewalDecisions = parseBooleanParam(url.searchParams.get("includeRenewalDecisions"), {
    defaultValue: true,
  });
  if (!includeReminders.ok) return invalidBooleanQueryParam("includeReminders");
  if (!includeObligations.ok) return invalidBooleanQueryParam("includeObligations");
  if (!includeRenewalCheckpoints.ok) return invalidBooleanQueryParam("includeRenewalCheckpoints");
  if (!includeRenewalDecisions.ok) return invalidBooleanQueryParam("includeRenewalDecisions");
  const roleDefaults = {
    includeReminders: includeReminders.value,
    includeObligations: includeObligations.value,
    includeRenewalCheckpoints: includeRenewalCheckpoints.value,
    includeRenewalDecisions: includeRenewalDecisions.value || role === "finance" || role === "manager",
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
    await recordV10AuditEvent(admin, {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      action: "export.calendar.completed",
      targetType: "organization",
      targetId: membership.organization_id,
      outcome: "success",
      safeMetadata: {
        export_type: "calendar_ics",
        include_reminders: roleDefaults.includeReminders,
        include_obligations: roleDefaults.includeObligations,
        include_renewal_checkpoints: roleDefaults.includeRenewalCheckpoints,
        include_renewal_decisions: roleDefaults.includeRenewalDecisions,
      },
    });
    const fileName = sanitizeExportFileName("oblixa-calendar.ics");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDispositionAttachment(fileName),
      },
    });
  } catch (error) {
    console.error("[export/calendar] could not build calendar export:", formatUnknownForServerLog(error));
    await emitProductTelemetryEvent(admin, {
      organizationId: membership.organization_id,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        export_type: "calendar_ics",
        reason: "calendar_build_failed",
      },
    });
    return jsonProblem(500, {
      error: "Could not build calendar export.",
      code: "calendar_export_build_failed",
      diagnostic_id: "calendar_export_build_failed",
      route: ROUTE,
    });
  }
}
