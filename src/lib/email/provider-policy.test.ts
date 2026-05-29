import { describe, expect, it } from "vitest";
import {
  EMAIL_AUTH_DNS_EXPECTATION_TYPES,
  assertValidEmailSender,
  buildListUnsubscribeHeaders,
  sanitizeEmailProviderFailure,
  summarizeEmailAuthDnsExpectations,
} from "@/lib/email/provider-policy";

describe("email provider policy", () => {
  it("rejects malformed senders and CRLF injection", () => {
    expect(() => assertValidEmailSender("hello@oblixa.io")).not.toThrow();
    expect(() => assertValidEmailSender("bad\r\nBcc: attacker@example.com")).toThrow(/crlf/i);
    expect(() => assertValidEmailSender("not-an-email")).toThrow(/invalid_email_sender/);
  });

  it("builds RFC 8058 unsubscribe headers without allowing header injection", () => {
    expect(
      buildListUnsubscribeHeaders({
        mailto: "mailto:unsubscribe@oblixa.io",
        oneClickUrl: "https://app.oblixa.io/api/email/unsubscribe?t=tok_123",
      })
    ).toEqual({
      "List-Unsubscribe": "<mailto:unsubscribe@oblixa.io>, <https://app.oblixa.io/api/email/unsubscribe?t=tok_123>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(() => buildListUnsubscribeHeaders({ oneClickUrl: "https://x\r\nBcc: y" })).toThrow(/crlf/i);
  });

  it("redacts provider failure text before diagnostics", () => {
    const out = sanitizeEmailProviderFailure(
      new Error("Resend failed access_token=secret-token recipient@example.com")
    );
    expect(out).toContain("[redacted]");
    expect(out).not.toContain("secret-token");
    expect(out).not.toContain("recipient@example.com");
  });

  it("summarizes SPF, DKIM, DMARC, MX, and MTA-STS DNS expectations", () => {
    const summary = summarizeEmailAuthDnsExpectations(
      EMAIL_AUTH_DNS_EXPECTATION_TYPES.map((type) => ({
        type,
        host: `${type.toLowerCase()}.oblixa.io`,
        expected: "fixture",
      }))
    );
    expect(summary.every((row) => row.present)).toBe(true);
  });
});
