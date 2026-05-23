import { createHmac, timingSafeEqual } from "crypto";

/**
 * Optional HMAC for inbound email automation (tasks/from-email).
 * When `EMAIL_INBOUND_HMAC_SECRET` is set, callers must send header `X-Oblixa-Email-Signature: sha256=<hex>`
 * over the raw JSON body bytes.
 */
export function verifyInboundEmailHmac(params: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  maxSkewSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  const raw = params.signatureHeader?.trim() ?? "";
  const m = /^sha256=([a-f0-9]{64})$/i.exec(raw);
  if (!m) return { ok: false, reason: "missing_or_invalid_signature_format" };
  const timestamp = params.timestampHeader?.trim() ?? "";
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "missing_or_invalid_timestamp" };
  const skew = params.maxSkewSec ?? 300;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (ageSec > skew) return { ok: false, reason: "timestamp_skew" };
  const expected = createHmac("sha256", params.secret).update(`${timestamp}.${params.rawBody}`).digest("hex");
  const a = Buffer.from(m[1], "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}
