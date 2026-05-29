import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_INTEGRATION_DISCONNECT_SCENARIO_IDS,
  OPERATIONAL_INTEGRATION_SYNC_JOB_IDS,
  OPERATIONAL_INTEGRATION_SYNC_JOBS,
  OPERATIONAL_OAUTH_NEGATIVE_PATH_IDS,
  OPERATIONAL_TOKEN_REFRESH_SCENARIO_IDS,
  buildOperationalIntegrationDisconnectPatch,
  shouldRunOperationalIntegrationSync,
  validateOperationalIntegrationSyncRegistry,
} from "@/lib/integrations/operational-sync";

describe("operational integration sync registry", () => {
  it("covers every sync, OAuth, refresh, and disconnect operational scenario", () => {
    expect(validateOperationalIntegrationSyncRegistry()).toEqual([]);
    expect(new Set(OPERATIONAL_INTEGRATION_SYNC_JOBS.map((row) => row.id))).toEqual(
      new Set(OPERATIONAL_INTEGRATION_SYNC_JOB_IDS)
    );
    expect(OPERATIONAL_OAUTH_NEGATIVE_PATH_IDS).toEqual(
      expect.arrayContaining([
        "missing_state",
        "wrong_state",
        "expired_state",
        "reused_state",
        "missing_code",
        "denied_consent",
        "wrong_redirect_uri",
        "provider_error",
        "callback_replay",
      ])
    );
    expect(OPERATIONAL_TOKEN_REFRESH_SCENARIO_IDS).toEqual(
      expect.arrayContaining([
        "success",
        "expired_refresh_token",
        "revoked_token",
        "provider_timeout",
        "rotated_encryption_key",
        "malformed_response",
        "repeated_failure",
      ])
    );
    expect(OPERATIONAL_INTEGRATION_DISCONNECT_SCENARIO_IDS).toEqual(
      expect.arrayContaining([
        "revocation",
        "local_token_deletion",
        "stale_scheduled_jobs",
        "webhook_cleanup",
        "audit_events",
        "user_facing_disconnected_state",
        "historical_record_preservation",
      ])
    );
  });

  it("skips disconnected rows before sync work", () => {
    expect(
      shouldRunOperationalIntegrationSync({
        jobId: "calendar_sync",
        connection: { provider: "google_calendar", status: "connected" },
      })
    ).toEqual({ allowed: true });
    expect(
      shouldRunOperationalIntegrationSync({
        jobId: "calendar_sync",
        connection: { provider: "google_calendar", status: "not_connected" },
      })
    ).toEqual({ allowed: false, reason: "not_connected" });
    expect(
      shouldRunOperationalIntegrationSync({
        jobId: "calendar_sync",
        connection: { provider: "crm", status: "connected" },
      })
    ).toEqual({ allowed: false, reason: "provider_not_in_job" });
  });

  it("builds a disconnect patch that removes future provider access without deleting history", () => {
    const patch = buildOperationalIntegrationDisconnectPatch({
      nowIso: "2026-05-29T00:00:00.000Z",
      reason: "rotated provider app",
    });

    expect(patch).toMatchObject({
      status: "not_connected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      connected_account: null,
      oauth_connected_at: null,
      last_synced_at: null,
      last_error: null,
      config_json: {
        disconnected_at: "2026-05-29T00:00:00.000Z",
        disconnect_reason: "rotated provider app",
        cleanup: "tokens_webhooks_and_provider_endpoints_removed",
      },
    });
    expect(JSON.stringify(patch)).not.toContain("webhookUrl");
    expect(JSON.stringify(patch)).not.toContain("clientSecret");
  });
});
