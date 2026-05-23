import { describe, expect, it } from "vitest";
import {
  INTERNAL_HMAC_BODY_SHA256_HEADER,
  INTERNAL_HMAC_KEY_ID_HEADER,
  INTERNAL_HMAC_SIGNATURE_HEADER,
  signInternalRequest,
  verifyInternalHmacRequest,
} from "@/lib/security/internal-hmac";

describe("internal-hmac", () => {
  const current = "current-internal-hmac-secret-32-bytes";
  const previous = "previous-internal-hmac-secret-32-bytes";
  const nowMs = 1_700_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000));
  const body = JSON.stringify({ contractId: "c1" });

  it("accepts a current signed request bound to method, path, timestamp, and body hash", () => {
    const headers = signInternalRequest({
      secret: current,
      method: "POST",
      path: "/api/extract/run",
      body,
      keyId: "current",
      timestamp,
    });
    const request = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers,
      body,
    });

    expect(
      verifyInternalHmacRequest(request, { body, currentSecret: current, previousSecret: previous, nowMs })
    ).toEqual({ ok: true, secretSlot: "current" });
  });

  it("accepts previous secret during rotation", () => {
    const headers = signInternalRequest({
      secret: previous,
      method: "POST",
      path: "/api/extract/run",
      body,
      keyId: "previous",
      timestamp,
    });
    const request = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers,
      body,
    });

    expect(
      verifyInternalHmacRequest(request, {
        body,
        currentSecret: current,
        previousSecret: previous,
        previousSecretExpiresAt: "2099-01-01T00:00:00.000Z",
        nowMs,
      })
    ).toEqual({ ok: true, secretSlot: "previous" });
  });

  it("rejects previous secret without future expiry metadata in strict rotation mode", () => {
    const headers = signInternalRequest({
      secret: previous,
      method: "POST",
      path: "/api/extract/run",
      body,
      keyId: "previous",
      timestamp,
    });
    const request = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers,
      body,
    });

    expect(
      verifyInternalHmacRequest(request, {
        body,
        currentSecret: current,
        previousSecret: previous,
        nowMs,
        strictPreviousSecretExpiry: true,
      })
    ).toEqual({ ok: false, reason: "previous_secret_expiry_required" });
    expect(
      verifyInternalHmacRequest(request, {
        body,
        currentSecret: current,
        previousSecret: previous,
        previousSecretExpiresAt: "2000-01-01T00:00:00.000Z",
        nowMs,
      })
    ).toEqual({ ok: false, reason: "previous_secret_expired" });
  });

  it("rejects missing or unknown key ids", () => {
    const headers = signInternalRequest({
      secret: current,
      method: "POST",
      path: "/api/extract/run",
      body,
      keyId: "current",
      timestamp,
    });
    const missingKeyRequest = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers: Object.fromEntries(Object.entries(headers).filter(([key]) => key !== INTERNAL_HMAC_KEY_ID_HEADER)),
      body,
    });
    expect(verifyInternalHmacRequest(missingKeyRequest, { body, currentSecret: current, nowMs })).toEqual({
      ok: false,
      reason: "missing_key_id",
    });

    const unknownKeyRequest = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers: { ...headers, [INTERNAL_HMAC_KEY_ID_HEADER]: "retired" },
      body,
    });
    expect(verifyInternalHmacRequest(unknownKeyRequest, { body, currentSecret: current, nowMs })).toEqual({
      ok: false,
      reason: "unknown_key_id",
    });
  });

  it("rejects stale timestamps and tampered bodies", () => {
    const headers = signInternalRequest({
      secret: current,
      method: "POST",
      path: "/api/extract/run",
      body,
      keyId: "current",
      timestamp,
    });
    const request = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers,
      body: JSON.stringify({ contractId: "c2" }),
    });

    expect(
      verifyInternalHmacRequest(request, {
        body: JSON.stringify({ contractId: "c2" }),
        currentSecret: current,
        nowMs,
      })
    ).toEqual({ ok: false, reason: "body_hash_mismatch" });

    expect(
      verifyInternalHmacRequest(request, {
        body,
        currentSecret: current,
        nowMs: nowMs + 10 * 60 * 1000,
      })
    ).toEqual({ ok: false, reason: "timestamp_skew" });
  });

  it("rejects missing or malformed signature material", () => {
    const request = new Request("https://app.test/api/extract/run", {
      method: "POST",
      headers: {
        [INTERNAL_HMAC_BODY_SHA256_HEADER]: "not-hex",
        [INTERNAL_HMAC_KEY_ID_HEADER]: "current",
        [INTERNAL_HMAC_SIGNATURE_HEADER]: "sha256=bad",
        "x-oblixa-internal-timestamp": timestamp,
      },
      body,
    });

    expect(verifyInternalHmacRequest(request, { body, currentSecret: current, nowMs })).toEqual({
      ok: false,
      reason: "body_hash_mismatch",
    });
  });
});
