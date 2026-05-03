import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";

/** Headers for cron JSON deny responses (avoid importing api-guards to prevent cycles). */
export const CRON_DENY_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;

/** True when an unsigned cron probe got an auth-layer rejection (401 bad caller, 503 misconfigured). */
export function isCronAuthProbeRejectStatus(status: number): boolean {
  return status === 401 || status === 503;
}

/** Alias for scripts/docs that refer to "unsigned reject" semantics. */
export const isCronUnsignedRejectStatus = isCronAuthProbeRejectStatus;

function mergeDenyHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  for (const [k, v] of Object.entries(CRON_DENY_RESPONSE_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return headers;
}

/**
 * JSON deny when CRON_SECRET is unset. Prefer 503 so operators distinguish
 * misconfiguration from 401 bad/missing caller credentials.
 */
export function respondCronMissingEnv(init?: { headers?: HeadersInit }): NextResponse {
  console.error("[cron] denied reason=missing_env CRON_SECRET unset_or_blank");
  return NextResponse.json(
    {
      error: "Server misconfigured: scheduled routes require CRON_SECRET",
      code: "cron_secret_missing",
    },
    { status: 503, headers: mergeDenyHeaders(init?.headers) }
  );
}

export function respondCronUnauthorized(init?: { headers?: HeadersInit }): NextResponse {
  console.warn("[cron] denied reason=bad_bearer_or_header");
  return NextResponse.json(
    { error: "Unauthorized", code: "cron_unauthorized" },
    { status: 401, headers: mergeDenyHeaders(init?.headers) }
  );
}

/**
 * Returns null when the request is authorized for cron execution.
 * Otherwise a JSON NextResponse (503 missing env, 401 bad/missing secret headers).
 */
export function gateCronRequest(request: Request, init?: { headers?: HeadersInit }): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return respondCronMissingEnv(init);
  }
  if (!authorizeCronRequest(request, cronSecret)) {
    return respondCronUnauthorized(init);
  }
  return null;
}
