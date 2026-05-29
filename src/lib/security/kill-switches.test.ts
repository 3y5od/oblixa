import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isKillBilling,
  isKillCronFamily,
  isKillExtraction,
  isKillImportExport,
  isKillInboundAutomation,
  isKillIntegrationSync,
  isKillInvites,
  isKillOutboundEmail,
  isKillSignup,
  isKillWebhookDispatch,
  killSwitchAccessibleState,
  killSwitchJsonResponse,
  killSwitchOperationalTelemetry,
} from "@/lib/security/kill-switches";

describe("kill-switches", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "OBLIXA_KILL_SIGNUP",
      "OBLIXA_KILL_BILLING",
      "OBLIXA_KILL_EXTRACTION",
      "OBLIXA_KILL_OUTBOUND_EMAIL",
      "OBLIXA_KILL_CRON_FAMILY",
      "OBLIXA_KILL_IMPORT_EXPORT",
      "OBLIXA_KILL_INTEGRATION_SYNC",
      "OBLIXA_KILL_INVITES",
      "OBLIXA_KILL_INBOUND_AUTOMATION",
      "OBLIXA_KILL_WEBHOOK_DISPATCH",
    ]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("defaults all kills to off", () => {
    expect(isKillSignup()).toBe(false);
    expect(isKillBilling()).toBe(false);
    expect(isKillExtraction()).toBe(false);
    expect(isKillOutboundEmail()).toBe(false);
    expect(isKillCronFamily()).toBe(false);
    expect(isKillImportExport()).toBe(false);
    expect(isKillIntegrationSync()).toBe(false);
    expect(isKillInvites()).toBe(false);
    expect(isKillInboundAutomation()).toBe(false);
    expect(isKillWebhookDispatch()).toBe(false);
  });

  it("flips on when env is 1", () => {
    process.env.OBLIXA_KILL_SIGNUP = "1";
    process.env.OBLIXA_KILL_OUTBOUND_EMAIL = "1";
    process.env.OBLIXA_KILL_CRON_FAMILY = "1";
    process.env.OBLIXA_KILL_IMPORT_EXPORT = "1";
    process.env.OBLIXA_KILL_INTEGRATION_SYNC = "1";
    process.env.OBLIXA_KILL_WEBHOOK_DISPATCH = "1";
    expect(isKillSignup()).toBe(true);
    expect(isKillOutboundEmail()).toBe(true);
    expect(isKillCronFamily()).toBe(true);
    expect(isKillImportExport()).toBe(true);
    expect(isKillIntegrationSync()).toBe(true);
    expect(isKillWebhookDispatch()).toBe(true);
  });

  it("killSwitchJsonResponse returns 503 JSON", async () => {
    const res = killSwitchJsonResponse("test");
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toContain("Cookie");
    const body = await res.json();
    expect(body).toMatchObject({
      error: "Service temporarily unavailable",
      code: "service_temporarily_unavailable",
      diagnostic_id: "kill_switch_active",
      details: { subsystem: "test" },
    });
  });

  it("exposes sanitized operational telemetry and accessible paused state", () => {
    expect(killSwitchOperationalTelemetry("outbound_email")).toEqual({
      event: "operational.kill_switch_active",
      subsystem: "outbound_email",
      severity: "warning",
      redaction: "metadata-only",
    });
    expect(killSwitchAccessibleState("outbound_email")).toEqual({
      status: "paused",
      heading: "Temporarily unavailable",
      reason: "operator_kill_switch",
      subsystem: "outbound_email",
    });
  });
});
