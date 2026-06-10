import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies timestamped HMAC for inbound integration action callbacks.
 * Callers sign `${timestamp}.${rawBody}` with sha256 and send `sha256=<hex>`.
 */
export function verifyInboundCallbackHmac(params: {
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
