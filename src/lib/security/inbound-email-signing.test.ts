import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyInboundEmailHmac } from "@/lib/security/inbound-email-signing";

describe("verifyInboundEmailHmac", () => {
  it("accepts sha256 hex over raw body", () => {
    const secret = "email_hmac_secret_test";
    const raw = '{"organizationId":"00000000-0000-0000-0000-000000000001"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const hex = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
    expect(
      verifyInboundEmailHmac({
        secret,
        rawBody: raw,
        signatureHeader: `sha256=${hex}`,
        timestampHeader: timestamp,
      })
    ).toEqual({ ok: true });
  });

  it("rejects bad format", () => {
    expect(
      verifyInboundEmailHmac({
        secret: "s",
        rawBody: "{}",
        signatureHeader: "nope",
        timestampHeader: String(Math.floor(Date.now() / 1000)),
      }).ok
    ).toBe(false);
  });

  it("rejects stale timestamp", () => {
    const secret = "email_hmac_secret_test";
    const raw = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000) - 1_000);
    const hex = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
    expect(
      verifyInboundEmailHmac({
        secret,
        rawBody: raw,
        signatureHeader: `sha256=${hex}`,
        timestampHeader: timestamp,
      })
    ).toEqual({ ok: false, reason: "timestamp_skew" });
  });
});
