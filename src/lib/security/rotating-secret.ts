export type PreviousSecretStatus =
  | { ok: true; expiresAtMs: number | null }
  | { ok: false; reason: "previous_secret_expiry_required" | "previous_secret_expiry_invalid" | "previous_secret_expired" };

export function isStrictSecretRotationEnv(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.OBLIXA_STRICT_ENV === "1" ||
    env.OBLIXA_RELEASE_SECURITY_STRICT === "1" ||
    env.SECURITY_RELEASE_STRICT === "1"
  );
}

export function validatePreviousSecretExpiry(input: {
  previousSecret?: string | null;
  previousSecretExpiresAt?: string | null;
  nowMs?: number;
  strict?: boolean;
}): PreviousSecretStatus {
  const previousSecret = input.previousSecret?.trim();
  if (!previousSecret) return { ok: true, expiresAtMs: null };

  const strict = input.strict ?? isStrictSecretRotationEnv();
  const rawExpiry = input.previousSecretExpiresAt?.trim() ?? "";
  if (!rawExpiry) {
    return strict ? { ok: false, reason: "previous_secret_expiry_required" } : { ok: true, expiresAtMs: null };
  }

  const expiresAtMs = Date.parse(rawExpiry);
  if (!Number.isFinite(expiresAtMs)) return { ok: false, reason: "previous_secret_expiry_invalid" };
  if (expiresAtMs <= (input.nowMs ?? Date.now())) return { ok: false, reason: "previous_secret_expired" };
  return { ok: true, expiresAtMs };
}

export function rotatingSecretCandidates(input: {
  currentSecret?: string | null;
  previousSecret?: string | null;
  previousSecretExpiresAt?: string | null;
  nowMs?: number;
  strict?: boolean;
}): string[] {
  const currentSecret = input.currentSecret?.trim();
  const previousSecret = input.previousSecret?.trim();
  const candidates = currentSecret ? [currentSecret] : [];
  if (!previousSecret) return candidates;

  const previousStatus = validatePreviousSecretExpiry({
    previousSecret,
    previousSecretExpiresAt: input.previousSecretExpiresAt,
    nowMs: input.nowMs,
    strict: input.strict,
  });
  if (previousStatus.ok) candidates.push(previousSecret);
  return candidates;
}
