import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

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

  const body = await buildOrganizationCalendarIcs(admin, membership.organization_id, roleDefaults);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="oblixa-calendar.ics"',
    },
  });
}
