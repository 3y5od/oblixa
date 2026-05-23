import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifySlackSigningSecret } from "@/lib/security/slack-signing";

describe("verifySlackSigningSecret", () => {
  const secret = "test_slack_signing_secret";
  const body = '{"hello":"world"}';
  const ts = String(Math.floor(Date.now() / 1000));
  const base = `v0:${ts}:${body}`;
  const sig = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;

  it("accepts a valid signature", () => {
    expect(
      verifySlackSigningSecret({
        signingSecret: secret,
        rawBody: body,
        slackSignatureHeader: sig,
        slackTimestampHeader: ts,
        maxSkewSec: 600,
      })
    ).toEqual({ ok: true });
  });

  it("rejects tampered body", () => {
    const r = verifySlackSigningSecret({
      signingSecret: secret,
      rawBody: body + " ",
      slackSignatureHeader: sig,
      slackTimestampHeader: ts,
      maxSkewSec: 600,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects stale timestamp", () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 1_000);
    const staleSig = `v0=${createHmac("sha256", secret).update(`v0:${staleTs}:${body}`).digest("hex")}`;
    expect(
      verifySlackSigningSecret({
        signingSecret: secret,
        rawBody: body,
        slackSignatureHeader: staleSig,
        slackTimestampHeader: staleTs,
      })
    ).toEqual({ ok: false, reason: "slack_timestamp_skew" });
  });
});
