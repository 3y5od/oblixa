import { NextResponse } from "next/server";

export const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;

export type ProblemBody = {
  error: string;
  code: string;
  diagnostic_id: string;
  route?: string;
  request_id?: string;
  details?: Record<string, unknown>;
};

function mergeHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return headers;
}

export function jsonOk<T extends Record<string, unknown>>(
  body: T,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse<T> {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: mergeHeaders(init?.headers),
  });
}

export function jsonProblem(
  status: number,
  body: ProblemBody,
  init?: { headers?: HeadersInit }
): NextResponse<ProblemBody> {
  return NextResponse.json(body, {
    status,
    headers: mergeHeaders(init?.headers),
  });
}

export function jsonUnauthorized(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(401, {
    error: "Unauthorized",
    code: "unauthorized",
    diagnostic_id: "route_unauthorized",
    ...(route ? { route } : {}),
  });
}

export function jsonForbidden(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(403, {
    error: "Forbidden",
    code: "forbidden",
    diagnostic_id: "route_forbidden",
    ...(route ? { route } : {}),
  });
}

export function jsonNotFound(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(404, {
    error: "Not found",
    code: "not_found",
    diagnostic_id: "route_not_found",
    ...(route ? { route } : {}),
  });
}

export function jsonRateLimited(retryAfterMs: number, route?: string): NextResponse<ProblemBody> {
  return jsonProblem(429, {
    error: "Too many requests",
    code: "rate_limited",
    diagnostic_id: "route_rate_limited",
    ...(route ? { route } : {}),
    details: { retryAfterMs },
  });
}

export function jsonMisconfigured(missingEnv: string, route?: string): NextResponse<ProblemBody> {
  return jsonProblem(503, {
    error: "Server misconfigured",
    code: "server_misconfigured",
    diagnostic_id: "route_server_misconfigured",
    ...(route ? { route } : {}),
    details: { missing_env: missingEnv },
  });
}

export function jsonUnhandled(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(500, {
    error: "Unexpected server error",
    code: "unexpected_server_error",
    diagnostic_id: "route_unhandled_error",
    ...(route ? { route } : {}),
  });
}