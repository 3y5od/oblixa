import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyInboundEmailHmac } from "@/lib/security/inbound-email-signing";

describe("verifyInboundEmailHmac", () => {
  it("accepts sha256 hex over raw body", () => {
    const secret = "email_hmac_secret_test";
    const raw = '{"organizationId":"00000000-0000-0000-0000-000000000001"}';
    const hex = createHmac("sha256", secret).update(raw).digest("hex");
    expect(
      verifyInboundEmailHmac({
        secret,
        rawBody: raw,
        signatureHeader: `sha256=${hex}`,
      })
    ).toEqual({ ok: true });
  });

  it("rejects bad format", () => {
    expect(
      verifyInboundEmailHmac({
        secret: "s",
        rawBody: "{}",
        signatureHeader: "nope",
      }).ok
    ).toBe(false);
  });
});
