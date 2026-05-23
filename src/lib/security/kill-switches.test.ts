import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isKillBilling,
  isKillExtraction,
  isKillInboundAutomation,
  isKillInvites,
  isKillSignup,
  isKillWebhookDispatch,
  killSwitchJsonResponse,
} from "@/lib/security/kill-switches";

describe("kill-switches", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "OBLIXA_KILL_SIGNUP",
      "OBLIXA_KILL_BILLING",
      "OBLIXA_KILL_EXTRACTION",
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
    expect(isKillInvites()).toBe(false);
    expect(isKillInboundAutomation()).toBe(false);
    expect(isKillWebhookDispatch()).toBe(false);
  });

  it("flips on when env is 1", () => {
    process.env.OBLIXA_KILL_SIGNUP = "1";
    process.env.OBLIXA_KILL_WEBHOOK_DISPATCH = "1";
    expect(isKillSignup()).toBe(true);
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
});
