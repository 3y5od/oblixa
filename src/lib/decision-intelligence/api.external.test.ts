import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashExternalPasscode,
  isExternalActionTokenSyntax,
  signExternalSubmitTicket,
  verifyExternalSubmitTicket,
} from "@/lib/decision-intelligence/api";

describe("hashExternalPasscode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is deterministic for the same input in one process", () => {
    expect(hashExternalPasscode("secret-code")).toBe(hashExternalPasscode("secret-code"));
  });

  it("throws in production-like env when passcode pepper secrets are unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.EXTERNAL_ACTION_PASSCODE_PEPPER;
    delete process.env.CRON_SECRET;
    expect(() => hashExternalPasscode("x")).toThrow(/EXTERNAL_ACTION_PASSCODE_PEPPER/);
  });

  it("signExternalSubmitTicket works in production with dedicated submit secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET", "submit-ticket-secret");
    vi.stubEnv("EXTERNAL_ACTION_PASSCODE_PEPPER", "passcode-pepper");
    const ticket = signExternalSubmitTicket({ linkId: "link-1", urlToken: "tok" });
    expect(ticket.length).toBeGreaterThan(20);
    expect(verifyExternalSubmitTicket("tok", ticket, "link-1")).toEqual({ ok: true });
  });

  it("accepts previous submit-ticket secret during bounded rotation", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET", "submit-ticket-old");
    const ticket = signExternalSubmitTicket({ linkId: "link-1", urlToken: "tok" });

    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET", "submit-ticket-new");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS", "submit-ticket-old");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS_EXPIRES_AT", "2099-01-01T00:00:00.000Z");

    expect(verifyExternalSubmitTicket("tok", ticket, "link-1")).toEqual({ ok: true });
  });

  it("rejects expired previous submit-ticket secret during rotation", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET", "submit-ticket-old");
    const ticket = signExternalSubmitTicket({ linkId: "link-1", urlToken: "tok" });

    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET", "submit-ticket-new");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS", "submit-ticket-old");
    vi.stubEnv("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS_EXPIRES_AT", "2000-01-01T00:00:00.000Z");

    expect(verifyExternalSubmitTicket("tok", ticket, "link-1")).toEqual({
      ok: false,
      reason: "submit_ticket_invalid",
    });
  });

  it("rejects CRON_SECRET as submit-ticket HMAC key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "cron-only");
    delete process.env.EXTERNAL_ACTION_SUBMIT_TICKET_SECRET;
    delete process.env.EXTERNAL_ACTION_PASSCODE_PEPPER;
    expect(() => signExternalSubmitTicket({ linkId: "link-1", urlToken: "tok" })).toThrow(
      /EXTERNAL_ACTION_SUBMIT_TICKET_SECRET/
    );
  });
});

describe("isExternalActionTokenSyntax", () => {
  it("accepts issued external-action token formats", () => {
    expect(isExternalActionTokenSyntax("a".repeat(48))).toBe(true);
    expect(isExternalActionTokenSyntax("ap-00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isExternalActionTokenSyntax("pb-00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isExternalActionTokenSyntax("pe-00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isExternalActionTokenSyntax("v6-00000000-0000-4000-8000-000000000000")).toBe(true);
  });

  it("rejects malformed public token route params before lookup", () => {
    expect(isExternalActionTokenSyntax("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(isExternalActionTokenSyntax("../missing-token")).toBe(false);
    expect(isExternalActionTokenSyntax("token.with.dot")).toBe(false);
  });
});
