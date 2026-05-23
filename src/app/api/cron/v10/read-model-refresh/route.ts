import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  refreshV10ReadModelsForOrganization,
  type V10ReadModelKey,
  type V10ReadModelRefreshScope,
} from "@/lib/v10-read-model-refresh";
import { V10_REQUIRED_READ_MODEL_KEYS } from "@/lib/v10-read-models";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { parseFixedEnumParam, parseIsoTimestampParam, parsePositiveIntParam } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_ORG_LIMIT = 50;
const MAX_ORG_LIMIT = 250;
const READ_MODEL_REFRESH_SCOPES = [
  "full",
  "full_org",
  "incremental",
  "repair",
  "dry_run",
  "one_org",
  "one_contract",
  "one_model",
] as const satisfies readonly V10ReadModelRefreshScope[];
const CHANGED_SINCE_MAX_LOOKBACK_DAYS = 90;

function getOrgLimit(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  return parsePositiveIntParam(raw, { defaultValue: DEFAULT_ORG_LIMIT, max: MAX_ORG_LIMIT });
}

function getOrgCursor(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("after");
  return raw && /^[0-9a-f-]{8,}$/i.test(raw) ? raw : null;
}

function getRefreshScope(request: Request): V10ReadModelRefreshScope {
  const raw = new URL(request.url).searchParams.get("scope");
  return parseFixedEnumParam(raw, READ_MODEL_REFRESH_SCOPES, "full");
}

function getRefreshReason(scope: V10ReadModelRefreshScope): string {
  if (scope === "one_contract") return "operator_v10_read_model_contract_repair";
  if (scope === "one_model") return "operator_v10_read_model_model_repair";
  if (scope === "one_org" || scope === "full_org") return "operator_v10_read_model_org_rebuild";
  if (scope === "repair") return "operator_v10_read_model_repair";
  if (scope === "dry_run") return "operator_v10_read_model_dry_run";
  if (scope === "incremental") return "scheduled_v10_read_model_incremental_refresh";
  return "scheduled_v10_read_model_refresh";
}

function getSafeReasonOverride(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("reason");
  if (!raw) return null;
  const normalized = raw.trim().slice(0, 80);
  return /^[a-z0-9_:-]+$/i.test(normalized) ? normalized : null;
}

function getContractId(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("contract_id");
  if (!raw) return null;
  return /^[a-zA-Z0-9_-]{3,80}$/.test(raw) ? raw : null;
}

function getChangedSince(request: Request): { ok: true; value?: Date } | { ok: false; error: string } {
  const raw = new URL(request.url).searchParams.get("changed_since");
  const parsed = parseIsoTimestampParam(raw, { maxLookbackDays: CHANGED_SINCE_MAX_LOOKBACK_DAYS });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, value: parsed.date };
}

function getModelKeys(request: Request): V10ReadModelKey[] | undefined {
  const raw = new URL(request.url).searchParams.get("model_keys");
  if (!raw) return undefined;
  const requested = new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const valid = V10_REQUIRED_READ_MODEL_KEYS.filter((key) => requested.has(key));
  return valid.length > 0 ? valid : undefined;
}

export const GET = withCronRoute({
  route: "/api/cron/v10/read-model-refresh",
  healthcheckRoute: "cron/v10/read-model-refresh",
  rateLimitKey: "cron:v10:read-model-refresh",
  rateLimit: RATE_LIMITS.contractsRecomputeSignalsCron,
  handler: async ({ request, admin, startedAtMs }) => {
    const limit = getOrgLimit(request);
    const cursor = getOrgCursor(request);
    const refreshScope = getRefreshScope(request);
    const refreshReason = getSafeReasonOverride(request) ?? getRefreshReason(refreshScope);
    const contractId = getContractId(request);
    const modelKeys = getModelKeys(request);
    const changedSince = getChangedSince(request);
    if (!changedSince.ok) {
      return {
        status: 400,
        ok: false,
        errorsCount: 1,
        pingReason: "invalid_changed_since",
        body: {
          error: "changed_since must be a recent ISO timestamp",
          code: "invalid_changed_since",
          diagnostic_id: "v10_read_model_refresh_changed_since_invalid",
          details: { reason: changedSince.error },
        },
      };
    }
    let orgQuery = admin.from("organizations").select("id");
    if (cursor) {
      orgQuery = orgQuery.gt("id", cursor);
    }
    const { data: organizations, error } = await orgQuery.order("id", { ascending: true }).limit(limit);

    if (error) {
      console.error("[cron/v10/read-model-refresh] organization lookup failed:", error.message);
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        pingReason: "organization_lookup_failed",
        body: {
          error: "V10 read-model refresh failed",
          diagnostic_id: "v10_read_model_refresh_org_lookup_failed",
        },
      };
    }

    const organizationIds = (organizations ?? []).map((row) => String(row.id)).filter(Boolean);
    const results = [];
    for (const organizationId of organizationIds) {
      try {
        const refresh = await refreshV10ReadModelsForOrganization(admin, organizationId, {
          reason: refreshReason,
          refreshScope,
          contractId: refreshScope === "one_contract" ? contractId ?? undefined : undefined,
          modelKeys,
          changedSince: changedSince.value,
        });
        const auditEventId = await recordV10AuditEvent(admin, {
          organizationId,
          actorUserId: null,
          actorType: "system",
          action: "v10_read_models.scheduled_refresh",
          targetType: "workspace_health_diagnostic",
          targetId: organizationId,
          outcome: refresh.ok ? "success" : "server_error",
          safeMetadata: {
            refresh_job_id: refresh.diagnostics.refresh_job_id,
            refresh_scope: refreshScope,
            selected_model_keys: [...(refresh.diagnostics.selected_model_keys ?? [])],
            scoped_contract_id: refresh.diagnostics.scoped_contract_id,
            changed_since: refresh.diagnostics.changed_since,
            drift_state: refresh.diagnostics.model_freshness_state,
            failure_count: refresh.failures.length,
          },
          diagnosticId: refresh.ok ? null : `v10_read_model_refresh_${refresh.diagnostics.model_freshness_state}`,
        });
        results.push({
          organization_id: organizationId,
          ok: refresh.ok,
          refresh_job_id: refresh.diagnostics.refresh_job_id,
          refresh_scope: refreshScope,
          selected_model_keys: refresh.diagnostics.selected_model_keys,
          scoped_contract_id: refresh.diagnostics.scoped_contract_id,
          changed_since: refresh.diagnostics.changed_since,
          drift_state: refresh.diagnostics.model_freshness_state,
          failure_count: refresh.failures.length,
          audit_event_id: auditEventId,
        });
        continue;
      } catch (error) {
        const auditEventId = await recordV10AuditEvent(admin, {
          organizationId,
          actorUserId: null,
          actorType: "system",
          action: "v10_read_models.scheduled_refresh",
          targetType: "workspace_health_diagnostic",
          targetId: organizationId,
          outcome: "server_error",
          safeMetadata: {
            refresh_scope: refreshScope,
            failure_count: 1,
            error_class: error instanceof Error ? error.name : "unknown",
          },
          diagnosticId: "v10_read_model_refresh_unhandled_error",
        });
        results.push({
          organization_id: organizationId,
          ok: false,
          refresh_job_id: null,
          refresh_scope: refreshScope,
          drift_state: "failed",
          failure_count: 1,
          audit_event_id: auditEventId,
        });
        continue;
      }
    }

    const partial = results.some((result) => !result.ok);
    return {
      partial,
      errorsCount: results.reduce((count, result) => count + (result.ok ? 0 : 1), 0),
      pingReason: partial ? "partial" : "ok",
      body: {
        scanned_organizations: organizationIds.length,
        next_cursor: organizationIds.length === limit ? organizationIds[organizationIds.length - 1] : null,
        refresh_scope: refreshScope,
        results,
        duration_ms: Date.now() - startedAtMs,
      },
    };
  },
});
