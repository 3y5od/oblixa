import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getInboundAutomationSecret,
  isInboundAutomationAuthorized,
} from "@/lib/security/inbound-automation-token";

describe("inbound-automation-token", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    delete process.env.INBOUND_EMAIL_AUTOMATION_TOKEN;
    delete process.env.INBOUND_SLACK_AUTOMATION_TOKEN;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN;
  });

  it("uses route-specific secret when set", () => {
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN", "email-only");
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN", "shared");
    expect(getInboundAutomationSecret("email")).toBe("email-only");
  });

  it("falls back to INBOUND_AUTOMATION_TOKEN when route secret unset", () => {
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN", "shared");
    expect(getInboundAutomationSecret("slack")).toBe("shared");
  });

  it("returns null when no secret configured", () => {
    expect(getInboundAutomationSecret("integrations_callback")).toBeNull();
  });

  it("isInboundAutomationAuthorized returns true for matching bearer", () => {
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN", "secret-value");
    const ok = isInboundAutomationAuthorized(
      new Request("http://localhost/", {
        headers: { authorization: "Bearer secret-value" },
      }),
      "slack"
    );
    expect(ok).toBe(true);
  });

  it("isInboundAutomationAuthorized returns false for wrong token", () => {
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN", "secret-value");
    const ok = isInboundAutomationAuthorized(
      new Request("http://localhost/", {
        headers: { authorization: "Bearer other" },
      }),
      "email"
    );
    expect(ok).toBe(false);
  });
});
