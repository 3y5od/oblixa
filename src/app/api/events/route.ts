import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { filterAuditEventsForWorkspaceMode } from "@/lib/product-surface/audit-events-filter";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { secureCompareUtf8 } from "@/lib/security/secret-compare";
import { parseIsoTimestampParam, parsePositiveIntParam } from "@/lib/security/validation";
import type { WorkspaceRole } from "@/lib/navigation";

const ROUTE = "/api/events";
const EVENTS_SINCE_MAX_LOOKBACK_DAYS = 366;

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`events:${ip}`, RATE_LIMITS.eventsRead);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const admin = await createAdminClient();
  let organizationId: string | null = null;
  let workspaceRole: WorkspaceRole = "viewer";
  const apiKey = request.headers.get("x-api-key")?.trim() ?? "";
  if (apiKey) {
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyPrefix = apiKey.slice(0, 12);
    const { data: keyRow } = await admin
      .from("integration_api_keys")
      .select("id, organization_id, active, key_hash, key_prefix, scopes, expires_at, revoked_at")
      .eq("key_prefix", keyPrefix)
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();
    const now = Date.now();
    const expired =
      !!keyRow?.expires_at &&
      new Date(keyRow.expires_at).getTime() <= now;
    const hasScope = (keyRow?.scopes ?? []).includes("events:read");
    if (
      !keyRow ||
      expired ||
      !hasScope ||
      !secureCompareUtf8(keyRow.key_hash, keyHash)
    ) {
      return jsonProblem(401, {
        error: "Invalid API key",
        code: "invalid_api_key",
        diagnostic_id: "events_invalid_api_key",
        route: ROUTE,
      });
    }
    organizationId = keyRow.organization_id;
    await admin
      .from("integration_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);
  } else {
    const supabase = await createClient();
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
        code: "organization_missing",
        diagnostic_id: "events_organization_missing",
        route: ROUTE,
      });
    }
    organizationId = membership.organization_id;
    workspaceRole = membership.role;
  }

  if (!organizationId) {
    return jsonProblem(400, {
      error: "No organization found",
      code: "organization_missing",
      diagnostic_id: "events_organization_missing",
      route: ROUTE,
    });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: organizationId,
    role: workspaceRole,
    apiPath: "/api/events",
  });
  if (modeGate) return modeGate;

  const url = new URL(request.url);
  const limit = parsePositiveIntParam(url.searchParams.get("limit"), { defaultValue: 50, max: 200 });
  const since = url.searchParams.get("since");
  const parsedSince = parseIsoTimestampParam(since, { maxLookbackDays: EVENTS_SINCE_MAX_LOOKBACK_DAYS });
  if (!parsedSince.ok) {
    return jsonProblem(400, {
      error: "Invalid since parameter",
      code: "invalid_since",
      diagnostic_id: "events_since_invalid",
      route: ROUTE,
    });
  }

  let query = admin
    .from("audit_events")
    .select("id, contract_id, action, details, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (parsedSince.value) {
    query = query.gte("created_at", parsedSince.value);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/events] query error:", error.message);
    return jsonProblem(500, {
      error: "An unexpected error occurred",
      code: "events_query_failed",
      diagnostic_id: "events_query_failed",
      route: ROUTE,
    });
  }

  const v6 = await getOrgSettingsJson(admin, organizationId);
  const workspaceMode = parseWorkspaceMode(v6);
  const filtered = filterAuditEventsForWorkspaceMode(data ?? [], workspaceMode);

  return NextResponse.json({
    events: filtered,
    count: filtered.length,
  });
}
