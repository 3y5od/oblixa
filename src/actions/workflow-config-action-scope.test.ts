import { beforeEach, describe, expect, it, vi } from "vitest";

const workflowConfigMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  encryptIntegrationToken: vi.fn(),
  from: vi.fn(),
  getOrEnsureDeterministicMembership: vi.fn(),
  getUser: vi.fn(),
  hasSensitiveActionProof: vi.fn(),
  revalidatePath: vi.fn(),
  recordSecurityAuditEvent: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: workflowConfigMocks.cookies,
}));

vi.mock("next/cache", () => ({
  revalidatePath: workflowConfigMocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: workflowConfigMocks.createAdminClient,
  createClient: workflowConfigMocks.createClient,
  getOrEnsureDeterministicMembership: workflowConfigMocks.getOrEnsureDeterministicMembership,
}));

vi.mock("@/lib/security/token-crypto", () => ({
  encryptIntegrationToken: workflowConfigMocks.encryptIntegrationToken,
}));

vi.mock("@/lib/security/sensitive-action-proof", () => ({
  hasSensitiveActionProof: workflowConfigMocks.hasSensitiveActionProof,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent: workflowConfigMocks.recordSecurityAuditEvent,
}));

describe("workflow-config server action input safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    workflowConfigMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    workflowConfigMocks.createClient.mockResolvedValue({ auth: { getUser: workflowConfigMocks.getUser } });
    workflowConfigMocks.createAdminClient.mockResolvedValue({ from: workflowConfigMocks.from });
    workflowConfigMocks.getOrEnsureDeterministicMembership.mockResolvedValue({
      organization_id: "org-1",
      role: "admin",
    });
    workflowConfigMocks.cookies.mockResolvedValue({
      set: vi.fn(),
    });
    workflowConfigMocks.hasSensitiveActionProof.mockResolvedValue(true);
    workflowConfigMocks.encryptIntegrationToken.mockImplementation((value: string | null) =>
      value ? `encrypted:${value}` : null
    );
  });

  it("createWebhookSubscriptionForm rejects unsafe webhook URLs before auth or writes", async () => {
    const { createWebhookSubscriptionForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("url", "https://example.com/webhook\u202Ehidden");
    fd.set("secret", "secret-value");

    const result = await createWebhookSubscriptionForm(fd);

    expect(result).toEqual({ error: "Webhook URL contains unsupported characters" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.from).not.toHaveBeenCalled();
  });

  it("createFieldTemplateForm rejects unsafe default values before auth or writes", async () => {
    const { createFieldTemplateForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("fieldName", "payment_terms");
    fd.set("defaultValue", "net_30\u202Ehidden");

    const result = await createFieldTemplateForm(fd);

    expect(result).toEqual({ error: "Default value contains unsupported characters" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.from).not.toHaveBeenCalled();
  });

  it("createTaskTemplateForm rejects unsafe task details before auth or writes", async () => {
    const { createTaskTemplateForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("title", "Prepare renewal memo");
    fd.set("details", "normal text\u202Ehidden");
    fd.set("dueOffsetDays", "7");
    fd.set("priority", "medium");

    const result = await createTaskTemplateForm(fd);

    expect(result).toEqual({ error: "Task details contains unsupported characters" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.from).not.toHaveBeenCalled();
  });

  it("upsertIntegrationConnectionForm rejects unsafe JSON keys before auth or writes", async () => {
    const { upsertIntegrationConnectionForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("provider", "slack");
    fd.set("status", "connected");
    fd.set("configJson", '{"__proto__":{"polluted":true}}');

    const result = await upsertIntegrationConnectionForm(fd);

    expect(result).toEqual({ error: "Invalid configJson payload" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.from).not.toHaveBeenCalled();
  });

  it("upsertWorkflowSettingsForm clamps malformed numeric settings into bounded config", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    workflowConfigMocks.from.mockReturnValue({ upsert });

    const { upsertWorkflowSettingsForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("weeklyIntakeLookbackDays", "999");
    fd.set("renewalHorizonDays", "-10");
    fd.set("staleContractDays", "not-a-number");
    fd.set("staleOwnershipDays", "9999");
    fd.set("emailQuietStartUtc", "99");
    fd.set("emailQuietEndUtc", "not-a-number");
    fd.set("slackQuietStartUtc", "-5");
    fd.set("slackQuietEndUtc", "24");
    fd.set("emailBlockedTypes", "renewal.due, task:created");
    fd.set("slackBlockedTypes", "sla-missed");
    fd.set("rolePolicyJson", '{"admin":{"settings_manage":true}}');

    const result = await upsertWorkflowSettingsForm(fd);

    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        weekly_intake_lookback_days: 30,
        renewal_horizon_days: 30,
        stale_contract_days: 120,
        stale_ownership_days: 365,
        notification_policy_json: {
          email: {
            enabled: false,
            quiet_hours_start_utc: 23,
            quiet_hours_end_utc: 0,
            blocked_types: ["renewal.due", "task:created"],
          },
          slack: {
            enabled: false,
            quiet_hours_start_utc: 0,
            quiet_hours_end_utc: 23,
            blocked_types: ["sla-missed"],
          },
        },
        role_policy_json: { admin: { settings_manage: true } },
      }),
      expect.any(Object)
    );
  });

  it("createIntegrationApiKeyFromOperationsForm rejects unsafe labels before auth or membership", async () => {
    const { createIntegrationApiKeyFromOperationsForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("label", "Events key\u202Ehidden");

    const result = await createIntegrationApiKeyFromOperationsForm(fd);

    expect(result).toBeUndefined();
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.getOrEnsureDeterministicMembership).not.toHaveBeenCalled();
  });

  it("revokeIntegrationApiKeyForm rejects unsafe revocation reasons before auth or cookies", async () => {
    const { revokeIntegrationApiKeyForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("keyId", "550e8400-e29b-41d4-a716-446655440000");
    fd.set("reason", "rotated\u202Ehidden");

    const result = await revokeIntegrationApiKeyForm(fd);

    expect(result).toEqual({ error: "Revocation reason contains unsupported characters" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.cookies).not.toHaveBeenCalled();
  });

  it("setIntegrationTokenForm rejects unsafe connected accounts before auth or cookies", async () => {
    const { setIntegrationTokenForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("provider", "slack");
    fd.set("connectedAccount", "ops@example.com\u202Ehidden");

    const result = await setIntegrationTokenForm(fd);

    expect(result).toEqual({ error: "Connected account contains unsupported characters" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.cookies).not.toHaveBeenCalled();
  });

  it("disconnectIntegrationConnectionForm rejects unsafe reasons before auth or cookies", async () => {
    const { disconnectIntegrationConnectionForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("provider", "slack");
    fd.set("reason", "rotated\u202Ehidden");

    const result = await disconnectIntegrationConnectionForm(fd);

    expect(result).toEqual({ error: "Disconnect reason contains unsupported characters" });
    expect(workflowConfigMocks.createClient).not.toHaveBeenCalled();
    expect(workflowConfigMocks.cookies).not.toHaveBeenCalled();
  });

  it("disconnectIntegrationConnectionForm removes tokens and webhook config while auditing", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "conn-1",
        organization_id: "org-1",
        provider: "slack",
        status: "connected",
      },
      error: null,
    }));
    const selectEqProvider = vi.fn(() => ({ maybeSingle }));
    const selectEqOrg = vi.fn(() => ({ eq: selectEqProvider }));
    const updateEqOrg = vi.fn(async () => ({ error: null }));
    const updateEqId = vi.fn(() => ({ eq: updateEqOrg }));
    const update = vi.fn((patch: unknown) => {
      void patch;
      return { eq: updateEqId };
    });
    workflowConfigMocks.from.mockImplementation((table: string) => {
      if (table !== "integration_connections") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => ({ eq: selectEqOrg })),
        update,
      };
    });

    const { disconnectIntegrationConnectionForm } = await import("@/actions/workflow-config");
    const fd = new FormData();
    fd.set("provider", "slack");
    fd.set("reason", "rotated provider app");

    const result = await disconnectIntegrationConnectionForm(fd);

    expect(result).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "not_connected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        connected_account: null,
        oauth_connected_at: null,
        last_synced_at: null,
        last_error: null,
        config_json: expect.objectContaining({
          disconnect_reason: "rotated provider app",
          cleanup: "tokens_webhooks_and_provider_endpoints_removed",
        }),
      })
    );
    expect(JSON.stringify(update.mock.calls[0]?.[0])).not.toContain("webhookUrl");
    expect(workflowConfigMocks.recordSecurityAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.integration_disconnected",
        targetType: "integration_connection",
        targetId: "conn-1",
        safeMetadata: expect.objectContaining({
          provider: "slack",
          localTokenDeletion: true,
          webhookCleanup: true,
          staleScheduledJobsBlocked: true,
          historicalRecordPreserved: true,
        }),
      })
    );
    expect(workflowConfigMocks.revalidatePath).toHaveBeenCalledWith("/settings/operations");
  });
});
