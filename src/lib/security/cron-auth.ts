import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";

/** Shared cron auth: Authorization Bearer or x-cron-secret header. */
export function authorizeCronRequest(request: Request, cronSecret: string): boolean {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  if (bearer && secureCompareUtf8(bearer, cronSecret)) {
    return true;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret && secureCompareUtf8(headerSecret.trim(), cronSecret)) {
    return true;
  }
  return false;
}
