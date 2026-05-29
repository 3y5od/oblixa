import type { IntegrationConnection } from "@/lib/types";

export type OperationalIntegrationProvider = IntegrationConnection["provider"];

export const OPERATIONAL_INTEGRATION_SYNC_JOB_IDS = [
  "calendar_sync",
  "crm_sync",
  "token_refresh",
  "oauth_start",
  "oauth_callback",
  "disconnect",
] as const;

export const OPERATIONAL_OAUTH_NEGATIVE_PATH_IDS = [
  "missing_state",
  "wrong_state",
  "expired_state",
  "reused_state",
  "missing_code",
  "denied_consent",
  "wrong_redirect_uri",
  "provider_error",
  "callback_replay",
  "unsafe_state",
  "oversized_code",
  "unsupported_provider",
] as const;

export const OPERATIONAL_TOKEN_REFRESH_SCENARIO_IDS = [
  "success",
  "expired_refresh_token",
  "revoked_token",
  "provider_timeout",
  "rotated_encryption_key",
  "malformed_response",
  "repeated_failure",
  "invalid_refresh_url",
  "missing_refresh_config",
  "scan_truncation",
] as const;

export const OPERATIONAL_INTEGRATION_DISCONNECT_SCENARIO_IDS = [
  "revocation",
  "local_token_deletion",
  "stale_scheduled_jobs",
  "webhook_cleanup",
  "audit_events",
  "user_facing_disconnected_state",
  "historical_record_preservation",
] as const;

export type OperationalIntegrationSyncJobId = (typeof OPERATIONAL_INTEGRATION_SYNC_JOB_IDS)[number];

export type OperationalIntegrationSyncJob = {
  id: OperationalIntegrationSyncJobId;
  route: string;
  providers: readonly OperationalIntegrationProvider[];
  authBoundary: "cron" | "user_admin_step_up" | "provider_callback";
  tokenPolicy: "encrypted_access_refresh" | "provider_webhook_secret" | "none";
  refreshCadence: string;
  backoffPolicy: string;
  paginationPolicy: string;
  dedupePolicy: string;
  deletionHandling: string;
  failurePolicy: string;
  observability: readonly string[];
  tests: readonly string[];
};

export const OPERATIONAL_INTEGRATION_SYNC_JOBS: readonly OperationalIntegrationSyncJob[] = [
  {
    id: "calendar_sync",
    route: "/api/integrations/calendar/sync",
    providers: ["google_calendar", "outlook_calendar"],
    authBoundary: "cron",
    tokenPolicy: "provider_webhook_secret",
    refreshCadence: "cron route, bounded by RATE_LIMITS.integrationCalendarSync",
    backoffPolicy: "safeFetch timeout per connection, no unbounded retry loop",
    paginationPolicy: "forEachSupabaseRangePage over integration_connections",
    dedupePolicy: "one sync attempt per integration_connection id per scan",
    deletionHandling: "status other than connected is skipped before provider calls",
    failurePolicy: "persist last_error, emit calendar.sync_failed, and report partial route failure",
    observability: ["audit_events.integration.calendar_sync_run", "calendar.sync_ok", "calendar.sync_failed"],
    tests: ["src/app/api/integrations/calendar/sync/route.test.ts"],
  },
  {
    id: "crm_sync",
    route: "/api/integrations/crm/sync",
    providers: ["crm"],
    authBoundary: "cron",
    tokenPolicy: "provider_webhook_secret",
    refreshCadence: "cron route, bounded by RATE_LIMITS.integrationCrmSync",
    backoffPolicy: "safeFetch timeout per contract, no unbounded retry loop",
    paginationPolicy: "forEachSupabaseRangePage over connections and source contracts",
    dedupePolicy: "organization_id connection map plus external_reference_id/source_system source filter",
    deletionHandling: "status connected integration_connections only; not_connected rows are excluded before sync",
    failurePolicy: "persist crm_sync_status, persist connection last_error, and emit crm.sync_failed",
    observability: ["audit_events.crm.sync_ok", "crm.sync_ok", "crm.sync_failed"],
    tests: ["src/app/api/integrations/crm/sync/route.test.ts"],
  },
  {
    id: "token_refresh",
    route: "/api/integrations/refresh-tokens",
    providers: ["google_calendar", "outlook_calendar", "slack", "email", "crm"],
    authBoundary: "cron",
    tokenPolicy: "encrypted_access_refresh",
    refreshCadence: "cron route for tokens expiring within fifteen minutes",
    backoffPolicy: "one safeFetch attempt per connection with timeout and idempotency key replay guard",
    paginationPolicy: "forEachSupabaseRangePage over expiring connected refresh-token rows",
    dedupePolicy: "one refresh attempt per integration_connection id per scan",
    deletionHandling: "not_connected and error rows are excluded before decrypting refresh_token",
    failurePolicy: "persist sanitized last_error and never persist raw provider token failures",
    observability: ["api.mutation_authorized", "integrations_refresh_failed"],
    tests: ["src/app/api/integrations/refresh-tokens/route.test.ts"],
  },
  {
    id: "oauth_start",
    route: "/api/integrations/oauth/start",
    providers: ["google_calendar", "outlook_calendar", "slack", "email", "crm"],
    authBoundary: "user_admin_step_up",
    tokenPolicy: "none",
    refreshCadence: "user initiated",
    backoffPolicy: "rate limited and idempotency-key replay guarded",
    paginationPolicy: "single organization/provider lookup",
    dedupePolicy: "state nonce plus idempotency key scoped to organization and user",
    deletionHandling: "existing status not_connected rows may supply provider config but no tokens are reused",
    failurePolicy: "problem+json diagnostics with no client secret or token material",
    observability: ["security.integration_oauth_start_blocked", "api.mutation_authorized"],
    tests: ["src/app/api/integrations/oauth/start/route.test.ts"],
  },
  {
    id: "oauth_callback",
    route: "/api/integrations/oauth/callback",
    providers: ["google_calendar", "outlook_calendar", "slack", "email", "crm"],
    authBoundary: "provider_callback",
    tokenPolicy: "encrypted_access_refresh",
    refreshCadence: "provider callback",
    backoffPolicy: "single token exchange with safeFetch timeout",
    paginationPolicy: "single state and provider configuration lookup",
    dedupePolicy: "consume integration_oauth_states where consumed_at is null before token exchange",
    deletionHandling: "upsert reconnects provider status and replaces only current token fields",
    failurePolicy: "safe problem+json diagnostics and encrypted persistence only after successful exchange",
    observability: ["api.mutation_authorized", "oauth_callback_state_replay"],
    tests: ["src/app/api/integrations/oauth/callback/route.test.ts"],
  },
  {
    id: "disconnect",
    route: "server-action:disconnectIntegrationConnectionForm",
    providers: ["google_calendar", "outlook_calendar", "slack", "email", "crm"],
    authBoundary: "user_admin_step_up",
    tokenPolicy: "encrypted_access_refresh",
    refreshCadence: "user initiated",
    backoffPolicy: "single local persistence update, no provider retry loop",
    paginationPolicy: "single organization/provider lookup",
    dedupePolicy: "organization_id/provider unique connection row",
    deletionHandling: "sets status not_connected so scheduled sync and refresh jobs skip the row",
    failurePolicy: "local tokens and webhook/provider endpoints are removed before future provider access",
    observability: ["security.integration_disconnected"],
    tests: ["src/actions/workflow-config-action-scope.test.ts"],
  },
] as const;

export type OperationalIntegrationDisconnectPatch = {
  status: "not_connected";
  access_token: null;
  refresh_token: null;
  token_expires_at: null;
  connected_account: null;
  oauth_connected_at: null;
  last_synced_at: null;
  last_error: null;
  config_json: {
    disconnected_at: string;
    disconnect_reason: string;
    cleanup: "tokens_webhooks_and_provider_endpoints_removed";
  };
};

export function buildOperationalIntegrationDisconnectPatch(input: {
  nowIso: string;
  reason?: string | null;
}): OperationalIntegrationDisconnectPatch {
  const reason = input.reason?.trim() || "manual_disconnect";
  return {
    status: "not_connected",
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    connected_account: null,
    oauth_connected_at: null,
    last_synced_at: null,
    last_error: null,
    config_json: {
      disconnected_at: input.nowIso,
      disconnect_reason: reason.slice(0, 240),
      cleanup: "tokens_webhooks_and_provider_endpoints_removed",
    },
  };
}

export function isOperationalIntegrationConnected(
  connection: Pick<IntegrationConnection, "status"> | null | undefined
): boolean {
  return connection?.status === "connected";
}

export function shouldRunOperationalIntegrationSync(input: {
  jobId: OperationalIntegrationSyncJobId;
  connection: Pick<IntegrationConnection, "status" | "provider"> | null | undefined;
}): { allowed: true } | { allowed: false; reason: "missing_connection" | "not_connected" | "provider_not_in_job" } {
  if (!input.connection) return { allowed: false, reason: "missing_connection" };
  if (!isOperationalIntegrationConnected(input.connection)) return { allowed: false, reason: "not_connected" };
  const job = OPERATIONAL_INTEGRATION_SYNC_JOBS.find((row) => row.id === input.jobId);
  if (!job?.providers.includes(input.connection.provider)) {
    return { allowed: false, reason: "provider_not_in_job" };
  }
  return { allowed: true };
}

export function validateOperationalIntegrationSyncRegistry(): string[] {
  const issues: string[] = [];
  const jobIds = new Set<OperationalIntegrationSyncJobId>();
  for (const job of OPERATIONAL_INTEGRATION_SYNC_JOBS) {
    if (jobIds.has(job.id)) issues.push(`${job.id}:duplicate_job`);
    jobIds.add(job.id);
    if (job.providers.length === 0) issues.push(`${job.id}:missing_provider`);
    if (!job.route) issues.push(`${job.id}:missing_route`);
    if (!job.tests.length) issues.push(`${job.id}:missing_tests`);
    if (!job.observability.length) issues.push(`${job.id}:missing_observability`);
    if (!/skip|excluded|not_connected|status/i.test(job.deletionHandling)) {
      issues.push(`${job.id}:missing_deletion_handling`);
    }
    if (!/timeout|idempotency|no unbounded|single/i.test(job.backoffPolicy)) {
      issues.push(`${job.id}:missing_bounded_retry_policy`);
    }
  }
  for (const id of OPERATIONAL_INTEGRATION_SYNC_JOB_IDS) {
    if (!jobIds.has(id)) issues.push(`${id}:missing_job`);
  }
  return issues.sort();
}
