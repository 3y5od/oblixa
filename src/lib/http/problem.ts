import { NextResponse } from "next/server";
import { deepRedactEmailLikeInUnknown, redactSensitiveLogString } from "@/lib/observability/log-redaction";

export const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization",
} as const;

export type ProblemBody = {
  error: string;
  code: string;
  diagnostic_id: string;
  route?: string;
  request_id?: string;
  details?: Record<string, unknown>;
};

type ProblemDetails = Record<string, unknown>;

export const SUPPORT_SAFE_PROBLEM_STATUSES = [400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 502, 503] as const;

const SENSITIVE_PROBLEM_DETAIL_KEY_RE =
  /(^|[_-])(stack|stacktrace|stack_trace|trace|exception|cause|sql|query|statement|provider_payload|provider_response|provider_error|raw_error|raw_message|raw_body)([_-]|$)/i;

function routeField(route?: string): Pick<ProblemBody, "route"> {
  return route ? { route } : {};
}

function detailsField(details?: ProblemDetails): Pick<ProblemBody, "details"> {
  return details ? { details } : {};
}

function redactProblemErrorMessage(error: string): string {
  const redacted = redactSensitiveLogString(error, 1000);
  const lower = error.toLowerCase();
  if (
    redacted !== error ||
    lower.includes("authorization") ||
    lower.includes("bearer ") ||
    lower.includes("cookie") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("signed_url") ||
    lower.includes("private_url") ||
    lower.includes("provider payload") ||
    lower.includes("provider response") ||
    lower.includes("provider error") ||
    lower.includes("https://") ||
    lower.includes("http://") ||
    lower.includes("duplicate key") ||
    lower.includes("foreign key") ||
    lower.includes("violates") ||
    lower.includes("permission denied") ||
    lower.includes("rls") ||
    lower.includes("relation ") ||
    lower.includes("column ") ||
    lower.includes("syntax error") ||
    lower.includes("node_modules") ||
    lower.includes("typeerror") ||
    error.includes("    at ") ||
    error.includes("\n    at ") ||
    error.length > 240
  ) {
    return "Something went wrong. Please try again.";
  }
  return error;
}

function redactSensitiveProblemDetailKeys(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max-depth]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitiveProblemDetailKeys(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_PROBLEM_DETAIL_KEY_RE.test(key) ? "[redacted]" : redactSensitiveProblemDetailKeys(nested, depth + 1);
  }
  return out;
}

function sanitizeProblemDetails(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;
  return redactSensitiveProblemDetailKeys(deepRedactEmailLikeInUnknown(details)) as Record<string, unknown>;
}

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

export function jsonProblem<T extends ProblemBody>(
  status: number,
  body: T,
  init?: { headers?: HeadersInit }
): NextResponse<T> {
  return NextResponse.json({ ...body, error: redactProblemErrorMessage(body.error), details: sanitizeProblemDetails(body.details) }, {
    status,
    headers: mergeHeaders(init?.headers),
  });
}

export function jsonBadRequest(route?: string, details?: ProblemDetails): NextResponse<ProblemBody> {
  return jsonProblem(400, {
    error: "Invalid request",
    code: "invalid_request",
    diagnostic_id: "route_invalid_request",
    ...routeField(route),
    ...detailsField(details),
  });
}

export function jsonUnauthorized(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(401, {
    error: "Unauthorized",
    code: "unauthorized",
    diagnostic_id: "route_unauthorized",
    ...routeField(route),
  });
}

export function jsonForbidden(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(403, {
    error: "Forbidden",
    code: "forbidden",
    diagnostic_id: "route_forbidden",
    ...routeField(route),
  });
}

export function jsonNotFound(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(404, {
    error: "Not found",
    code: "not_found",
    diagnostic_id: "route_not_found",
    ...routeField(route),
  });
}

export function jsonMethodNotAllowed(route?: string, allowedMethods: readonly string[] = []): NextResponse<ProblemBody> {
  const allow = allowedMethods.map((method) => method.trim().toUpperCase()).filter(Boolean).join(", ");
  return jsonProblem(
    405,
    {
      error: "Method not allowed",
      code: "method_not_allowed",
      diagnostic_id: "route_method_not_allowed",
      ...routeField(route),
      ...(allow ? { details: { allowed_methods: allow.split(", ") } } : {}),
    },
    allow ? { headers: { Allow: allow } } : undefined
  );
}

export function jsonConflict(route?: string, details?: ProblemDetails): NextResponse<ProblemBody> {
  return jsonProblem(409, {
    error: "Conflict",
    code: "conflict",
    diagnostic_id: "route_conflict",
    ...routeField(route),
    ...detailsField(details),
  });
}

export function jsonPayloadTooLarge(route?: string, details?: ProblemDetails): NextResponse<ProblemBody> {
  return jsonProblem(413, {
    error: "Payload too large",
    code: "payload_too_large",
    diagnostic_id: "route_payload_too_large",
    ...routeField(route),
    ...detailsField(details),
  });
}

export function jsonUnsupportedMediaType(route?: string, details?: ProblemDetails): NextResponse<ProblemBody> {
  return jsonProblem(415, {
    error: "Unsupported media type",
    code: "unsupported_media_type",
    diagnostic_id: "route_unsupported_media_type",
    ...routeField(route),
    ...detailsField(details),
  });
}

export function jsonUnprocessableEntity(route?: string, details?: ProblemDetails): NextResponse<ProblemBody> {
  return jsonProblem(422, {
    error: "Unprocessable entity",
    code: "unprocessable_entity",
    diagnostic_id: "route_unprocessable_entity",
    ...routeField(route),
    ...detailsField(details),
  });
}

export function jsonRateLimited(retryAfterMs: number, route?: string): NextResponse<ProblemBody> {
  return jsonProblem(
    429,
    {
      error: "Too many requests",
      code: "rate_limited",
      diagnostic_id: "route_rate_limited",
      ...routeField(route),
      details: { retryAfterMs },
    },
    {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    }
  );
}

export function jsonMisconfigured(missingEnv: string, route?: string): NextResponse<ProblemBody> {
  return jsonProblem(503, {
    error: "Server misconfigured",
    code: "server_misconfigured",
    diagnostic_id: "route_server_misconfigured",
    ...routeField(route),
    details: { missing_env: missingEnv },
  });
}

export function jsonUnhandled(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(500, {
    error: "Unexpected server error",
    code: "unexpected_server_error",
    diagnostic_id: "route_unhandled_error",
    ...routeField(route),
  });
}

export function jsonBadGateway(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(502, {
    error: "Upstream service failed",
    code: "bad_gateway",
    diagnostic_id: "route_bad_gateway",
    ...routeField(route),
  });
}

export function jsonServiceUnavailable(route?: string): NextResponse<ProblemBody> {
  return jsonProblem(503, {
    error: "Service unavailable",
    code: "service_unavailable",
    diagnostic_id: "route_service_unavailable",
    ...routeField(route),
  });
}
