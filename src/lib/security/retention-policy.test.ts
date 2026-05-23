import { describe, expect, it } from "vitest";
import {
  CODE_OWNED_RETENTION_POLICIES,
  retentionPolicyByDataClass,
  retentionPolicyTables,
} from "@/lib/security/retention-policy";

describe("code-owned retention policy metadata", () => {
  it("maps every requested transient data class to cleanup metadata", () => {
    expect(CODE_OWNED_RETENTION_POLICIES.map((policy) => policy.dataClass).sort()).toEqual([
      "calendar_feed_tokens",
      "expired_public_tokens",
      "extraction_artifacts",
      "import_raw_payloads",
      "oauth_callback_state",
      "report_tracking",
      "stale_audit_adjacent_payloads",
    ]);
    for (const policy of CODE_OWNED_RETENTION_POLICIES) {
      expect(policy.cleanupRpc).toBe("cleanup_code_owned_transient_data");
      expect(policy.retentionDays).toBeGreaterThan(0);
      expect(policy.timestampField).toMatch(/(?:_at|_expires_at)$/);
    }
  });

  it("exposes stable lookup helpers for cleanup checks and UI diagnostics", () => {
    expect(retentionPolicyByDataClass("report_tracking")).toMatchObject({
      table: "report_run_recipients",
      strategy: "revoke_and_redact_token",
    });
    expect(retentionPolicyByDataClass("missing")).toBeNull();
    expect(retentionPolicyTables()).toEqual([
      "calendar_feeds",
      "contract_extraction_jobs",
      "contract_import_job_rows",
      "external_action_events",
      "external_action_links",
      "integration_oauth_states",
      "report_run_recipients",
    ]);
  });
});
