import { describe, expect, it } from "vitest";

import { rotatingSecretCandidates, validatePreviousSecretExpiry } from "./rotating-secret";

describe("rotating-secret", () => {
  it("allows absent previous secrets", () => {
    expect(validatePreviousSecretExpiry({ strict: true })).toEqual({ ok: true, expiresAtMs: null });
  });

  it("allows non-strict compatibility rotation without expiry metadata", () => {
    expect(validatePreviousSecretExpiry({ previousSecret: "old-secret", strict: false })).toEqual({
      ok: true,
      expiresAtMs: null,
    });
  });

  it("requires future ISO expiry metadata in strict mode", () => {
    expect(
      validatePreviousSecretExpiry({
        previousSecret: "old-secret",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual({ ok: false, reason: "previous_secret_expiry_required" });

    expect(
      validatePreviousSecretExpiry({
        previousSecret: "old-secret",
        previousSecretExpiresAt: "not-a-date",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual({ ok: false, reason: "previous_secret_expiry_invalid" });

    expect(
      validatePreviousSecretExpiry({
        previousSecret: "old-secret",
        previousSecretExpiresAt: "2025-01-01T00:00:00.000Z",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual({ ok: false, reason: "previous_secret_expired" });

    expect(
      validatePreviousSecretExpiry({
        previousSecret: "old-secret",
        previousSecretExpiresAt: "2026-01-02T00:00:00.000Z",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual({ ok: true, expiresAtMs: Date.parse("2026-01-02T00:00:00.000Z") });
  });

  it("builds current and previous secret candidates only when previous metadata is valid", () => {
    expect(
      rotatingSecretCandidates({
        currentSecret: "current",
        previousSecret: "previous",
        previousSecretExpiresAt: "2026-01-02T00:00:00.000Z",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual(["current", "previous"]);

    expect(
      rotatingSecretCandidates({
        currentSecret: "current",
        previousSecret: "previous",
        previousSecretExpiresAt: "2025-01-02T00:00:00.000Z",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual(["current"]);

    expect(
      rotatingSecretCandidates({
        currentSecret: "current",
        previousSecret: "previous",
        strict: true,
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      })
    ).toEqual(["current"]);
  });
});
