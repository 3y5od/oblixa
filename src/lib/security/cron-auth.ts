import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { validatePreviousSecretExpiry } from "@/lib/security/rotating-secret";

function cronSecretMatches(candidate: string | null | undefined, secrets: string[]): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  return secrets.some((secret) => secureCompareUtf8(trimmed, secret));
}

/** Shared cron auth: Authorization Bearer or supported cron secret headers. */
export function authorizeCronRequest(
  request: Request,
  cronSecret: string,
  previousCronSecret?: string | null,
  previousCronSecretExpiresAt?: string | null
): boolean {
  const previousSecretStatus = validatePreviousSecretExpiry({
    previousSecret: previousCronSecret,
    previousSecretExpiresAt: previousCronSecretExpiresAt,
  });
  const usablePreviousSecret = previousSecretStatus.ok ? previousCronSecret?.trim() : undefined;
  const secrets = [cronSecret, usablePreviousSecret].filter((secret): secret is string => !!secret);
  const bearer = parseBearerToken(request.headers.get("authorization"));
  if (cronSecretMatches(bearer, secrets)) {
    return true;
  }

  for (const headerName of ["x-cron-secret", "x-vercel-cron-secret"] as const) {
    if (cronSecretMatches(request.headers.get(headerName), secrets)) {
      return true;
    }
  }

  return false;
}
