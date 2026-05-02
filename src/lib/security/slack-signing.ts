import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies Slack HTTP request signing (v0 scheme).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSigningSecret(params: {
  signingSecret: string;
  /** Raw request body string (must match what Slack signed). */
  rawBody: string;
  slackSignatureHeader: string | null;
  slackTimestampHeader: string | null;
  /** Reject if older than this many seconds (default 300). */
  maxSkewSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  const sig = params.slackSignatureHeader?.trim();
  const ts = params.slackTimestampHeader?.trim();
  if (!sig || !ts) return { ok: false, reason: "missing_slack_signature_headers" };
  if (!/^\d+$/.test(ts)) return { ok: false, reason: "invalid_slack_timestamp" };
  const skew = params.maxSkewSec ?? 300;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (ageSec > skew) return { ok: false, reason: "slack_timestamp_skew" };

  const base = `v0:${ts}:${params.rawBody}`;
  const h = createHmac("sha256", params.signingSecret).update(base).digest("hex");
  const expected = `v0=${h}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "slack_signature_mismatch" };
  }
  return { ok: true };
}
