import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";

/** Shared cron auth: Authorization Bearer or supported cron secret headers. */
export function authorizeCronRequest(request: Request, cronSecret: string): boolean {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  if (bearer && secureCompareUtf8(bearer, cronSecret)) {
    return true;
  }

  for (const headerName of ["x-cron-secret", "x-vercel-cron-secret"] as const) {
    const headerSecret = request.headers.get(headerName);
    if (headerSecret && secureCompareUtf8(headerSecret.trim(), cronSecret)) {
      return true;
    }
  }

  return false;
}
