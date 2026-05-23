import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getInboundAutomationSecret,
  getInboundAutomationSecrets,
  isInboundAutomationAuthorized,
} from "@/lib/security/inbound-automation-token";

describe("inbound-automation-token", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    delete process.env.INBOUND_AUTOMATION_TOKEN_PREVIOUS;
    delete process.env.INBOUND_EMAIL_AUTOMATION_TOKEN;
    delete process.env.INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS;
    delete process.env.INBOUND_SLACK_AUTOMATION_TOKEN;
    delete process.env.INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN;
    delete process.env.INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS;
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

  it("rejects shared token when a route-specific secret is configured", () => {
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN", "shared");
    vi.stubEnv("INBOUND_SLACK_AUTOMATION_TOKEN", "slack-only");
    const ok = isInboundAutomationAuthorized(
      new Request("http://localhost/", {
        headers: { authorization: "Bearer shared" },
      }),
      "slack"
    );
    expect(ok).toBe(false);
  });

  it("accepts previous route-specific and shared tokens during rotation", () => {
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN", "email-current");
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS", "email-previous");
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT", "2099-01-01T00:00:00.000Z");
    expect(getInboundAutomationSecrets("email")).toEqual(["email-current", "email-previous"]);
    expect(
      isInboundAutomationAuthorized(
        new Request("http://localhost/", {
          headers: { authorization: "Bearer email-previous" },
        }),
        "email"
      )
    ).toBe(true);

    vi.unstubAllEnvs();
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN_PREVIOUS", "shared-previous");
    vi.stubEnv("INBOUND_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT", "2099-01-01T00:00:00.000Z");
    expect(
      isInboundAutomationAuthorized(
        new Request("http://localhost/", {
          headers: { authorization: "Bearer shared-previous" },
        }),
        "integrations_callback"
      )
    ).toBe(true);
  });

  it("rejects expired previous inbound tokens during rotation", () => {
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN", "email-current");
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS", "email-previous");
    vi.stubEnv("INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT", "2000-01-01T00:00:00.000Z");
    expect(getInboundAutomationSecrets("email")).toEqual(["email-current"]);
    expect(
      isInboundAutomationAuthorized(
        new Request("http://localhost/", {
          headers: { authorization: "Bearer email-previous" },
        }),
        "email"
      )
    ).toBe(false);
  });
});
