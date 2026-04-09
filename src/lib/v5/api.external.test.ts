import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashExternalPasscode,
  signExternalSubmitTicket,
  verifyExternalSubmitTicket,
} from "@/lib/v5/api";

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

  it("signExternalSubmitTicket uses CRON_SECRET in production when dedicated secrets unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "cron-shared-secret");
    delete process.env.EXTERNAL_ACTION_SUBMIT_TICKET_SECRET;
    delete process.env.EXTERNAL_ACTION_PASSCODE_PEPPER;
    const ticket = signExternalSubmitTicket({ linkId: "link-1", urlToken: "tok" });
    expect(ticket.length).toBeGreaterThan(20);
    expect(
      verifyExternalSubmitTicket("tok", ticket, "link-1")
    ).toEqual({ ok: true });
  });
});
