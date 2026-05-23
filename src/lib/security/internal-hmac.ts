import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { validatePreviousSecretExpiry } from "@/lib/security/rotating-secret";

export const INTERNAL_HMAC_SIGNATURE_HEADER = "x-oblixa-internal-signature";
export const INTERNAL_HMAC_TIMESTAMP_HEADER = "x-oblixa-internal-timestamp";
export const INTERNAL_HMAC_BODY_SHA256_HEADER = "x-oblixa-internal-body-sha256";
export const INTERNAL_HMAC_KEY_ID_HEADER = "x-oblixa-internal-key-id";
export const INTERNAL_HMAC_MAX_SKEW_MS = 5 * 60 * 1000;
export const INTERNAL_HMAC_SECRET_ENV = "OBLIXA_INTERNAL_HMAC_SECRET";
export const INTERNAL_HMAC_PREVIOUS_SECRET_ENV = "OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET";
export const INTERNAL_HMAC_PREVIOUS_SECRET_EXPIRES_AT_ENV = "OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT";

export type InternalHmacFailureReason =
  | "missing_secret"
  | "missing_key_id"
  | "unknown_key_id"
  | "missing_signature"
  | "invalid_timestamp"
  | "timestamp_skew"
  | "missing_body_hash"
  | "body_hash_mismatch"
  | "previous_secret_expiry_required"
  | "previous_secret_expiry_invalid"
  | "previous_secret_expired"
  | "signature_mismatch";

export type InternalHmacVerifyResult =
  | { ok: true; secretSlot: "current" | "previous" }
  | { ok: false; reason: InternalHmacFailureReason };

function normalizePathForSigning(input: string): string {
  try {
    const url = new URL(input, "https://internal.local");
    return `${url.pathname}${url.search}`;
  } catch {
    return input.startsWith("/") ? input : `/${input}`;
  }
}

function normalizeSignature(raw: string | null): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  return value.startsWith("sha256=") ? value.slice("sha256=".length) : value;
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function canonicalInternalHmacPayload(input: {
  method: string;
  path: string;
  keyId: string;
  timestamp: string;
  bodySha256: string;
}): string {
  return [
    input.method.toUpperCase(),
    normalizePathForSigning(input.path),
    input.keyId,
    input.timestamp,
    input.bodySha256.toLowerCase(),
  ].join("\n");
}

export function signInternalRequest(input: {
  secret: string;
  method: string;
  path: string;
  body: string | Uint8Array;
  keyId?: string;
  timestamp?: string;
}): Record<string, string> {
  const keyId = input.keyId ?? "current";
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
  const bodySha256 = sha256Hex(input.body);
  const canonical = canonicalInternalHmacPayload({
    method: input.method,
    path: input.path,
    keyId,
    timestamp,
    bodySha256,
  });
  const signature = createHmac("sha256", input.secret).update(canonical).digest("hex");
  return {
    [INTERNAL_HMAC_TIMESTAMP_HEADER]: timestamp,
    [INTERNAL_HMAC_BODY_SHA256_HEADER]: bodySha256,
    [INTERNAL_HMAC_KEY_ID_HEADER]: keyId,
    [INTERNAL_HMAC_SIGNATURE_HEADER]: `sha256=${signature}`,
  };
}

export function verifyInternalHmacRequest(
  request: Request,
  input: {
    body: string | Uint8Array;
    currentSecret?: string | null;
    previousSecret?: string | null;
    currentKeyId?: string;
    previousKeyId?: string;
    previousSecretExpiresAt?: string | null;
    nowMs?: number;
    maxSkewMs?: number;
    strictPreviousSecretExpiry?: boolean;
  }
): InternalHmacVerifyResult {
  const currentSecret = input.currentSecret?.trim();
  const previousSecret = input.previousSecret?.trim();
  if (!currentSecret && !previousSecret) return { ok: false, reason: "missing_secret" };

  const keyId = request.headers.get(INTERNAL_HMAC_KEY_ID_HEADER)?.trim() ?? "";
  if (!keyId) return { ok: false, reason: "missing_key_id" };
  const currentKeyId = input.currentKeyId ?? "current";
  const previousKeyId = input.previousKeyId ?? "previous";
  if (keyId !== currentKeyId && keyId !== previousKeyId) return { ok: false, reason: "unknown_key_id" };

  const timestamp = request.headers.get(INTERNAL_HMAC_TIMESTAMP_HEADER)?.trim() ?? "";
  if (!/^\d{10}$/.test(timestamp)) return { ok: false, reason: "invalid_timestamp" };

  const nowMs = input.nowMs ?? Date.now();
  const timestampMs = Number(timestamp) * 1000;
  if (Math.abs(nowMs - timestampMs) > (input.maxSkewMs ?? INTERNAL_HMAC_MAX_SKEW_MS)) {
    return { ok: false, reason: "timestamp_skew" };
  }

  const claimedBodyHash = request.headers.get(INTERNAL_HMAC_BODY_SHA256_HEADER)?.trim() ?? "";
  if (!claimedBodyHash) return { ok: false, reason: "missing_body_hash" };
  if (!constantTimeHexEqual(claimedBodyHash, sha256Hex(input.body))) {
    return { ok: false, reason: "body_hash_mismatch" };
  }

  const actualSignature = normalizeSignature(request.headers.get(INTERNAL_HMAC_SIGNATURE_HEADER));
  if (!actualSignature) return { ok: false, reason: "missing_signature" };

  const canonical = canonicalInternalHmacPayload({
    method: request.method,
    path: request.url,
    keyId,
    timestamp,
    bodySha256: claimedBodyHash,
  });
  const candidates: Array<["current" | "previous", string | undefined]> =
    keyId === currentKeyId ? [["current", currentSecret]] : [["previous", previousSecret]];
  for (const [slot, secret] of candidates) {
    if (!secret) continue;
    if (slot === "previous") {
      const expiry = validatePreviousSecretExpiry({
        previousSecret: secret,
        previousSecretExpiresAt: input.previousSecretExpiresAt,
        nowMs,
        strict: input.strictPreviousSecretExpiry,
      });
      if (!expiry.ok) return { ok: false, reason: expiry.reason };
    }
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");
    if (constantTimeHexEqual(actualSignature, expected)) return { ok: true, secretSlot: slot };
  }

  return { ok: false, reason: "signature_mismatch" };
}
