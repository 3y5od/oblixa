import { NextResponse } from "next/server";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";
import {
  safeErrorClass,
  safeErrorMessage,
  type RouteFailurePhase,
  type RouteDependencyFailure,
} from "@/lib/route-runtime-contract";

type RateLimitConfig = (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];

export type ApiRouteHandlerContext = {
  request: Request;
  startedAtMs: number;
};

export type ApiRouteHandlerResult = {
  body: Record<string, unknown>;
  status?: number;
  ok?: boolean;
  partial?: boolean;
  errorsCount?: number;
  phase?: RouteFailurePhase;
  headers?: HeadersInit;
};

export type ApiRouteDependencyPreflightResult = Omit<RouteDependencyFailure, "ok" | "phase"> & {
  status?: number;
  phase?: RouteFailurePhase;
};

export type ApiRouteRunnerOptions = {
  route: string;
  rateLimitKey?: string | ((request: Request) => Promise<string> | string);
  rateLimit?: RateLimitConfig;
  responseHeaders?: HeadersInit;
  authorize?: (request: Request) => Promise<NextResponse | null> | NextResponse | null;
  preflight?: (request: Request) => Promise<NextResponse | null> | NextResponse | null;
  dependencyPreflight?: (
    request: Request
  ) => Promise<ApiRouteDependencyPreflightResult | null> | ApiRouteDependencyPreflightResult | null;
  handler: (ctx: ApiRouteHandlerContext) => Promise<ApiRouteHandlerResult | Record<string, unknown>>;
};

function normalizeHandlerResult(result: ApiRouteHandlerResult | Record<string, unknown>): ApiRouteHandlerResult {
  if ("body" in result && typeof result.body === "object" && result.body !== null) {
    return result as ApiRouteHandlerResult;
  }
  return { body: result as Record<string, unknown> };
}

function statusFor(ok: boolean, partial: boolean, explicit?: number): number {
  if (explicit) return explicit;
  if (partial) return 207;
  return ok ? 200 : 500;
}

function applyNoStore(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function applyResponseHeaders(response: NextResponse, headers?: HeadersInit): NextResponse {
  applyNoStore(response);
  if (!headers) return response;
  const extra = new Headers(headers);
  for (const [key, value] of extra.entries()) {
    response.headers.set(key, value);
  }
  return response;
}

export async function runApiRoute(request: Request, options: ApiRouteRunnerOptions): Promise<NextResponse> {
  const startedAtMs = Date.now();

  const deny = options.authorize ? await options.authorize(request) : null;
  if (deny) {
    return applyResponseHeaders(deny, options.responseHeaders);
  }

  if (options.rateLimitKey) {
    const rateLimitKey =
      typeof options.rateLimitKey === "function" ? await options.rateLimitKey(request) : options.rateLimitKey;
    const rate = await rateLimitCheck(rateLimitKey, options.rateLimit ?? RATE_LIMITS.v6CronDefault);
    if (!rate.ok) {
      return applyResponseHeaders(
        NextResponse.json(
          {
            ok: false,
            route: options.route,
            error: "Too many requests",
            code: "rate_limited",
            diagnostic_id: "route_rate_limited",
            phase: "rate_limit",
            retryAfterMs: rate.retryAfterMs,
            durationMs: Date.now() - startedAtMs,
          },
          { status: 429 }
        ),
        options.responseHeaders
      );
    }
  }

  const dependencyPreflight = options.dependencyPreflight ? await options.dependencyPreflight(request) : null;
  if (dependencyPreflight) {
    return applyResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          route: options.route,
          error: dependencyPreflight.error,
          code: dependencyPreflight.code,
          diagnostic_id: dependencyPreflight.diagnostic_id,
          phase: dependencyPreflight.phase ?? "dependency_preflight",
          details: dependencyPreflight.details,
          durationMs: Date.now() - startedAtMs,
        },
        { status: dependencyPreflight.status ?? 503 }
      ),
      options.responseHeaders
    );
  }

  const preflight = options.preflight ? await options.preflight(request) : null;
  if (preflight) {
    return applyResponseHeaders(preflight, options.responseHeaders);
  }

  try {
    const result = normalizeHandlerResult(await options.handler({ request, startedAtMs }));
    const partial = Boolean(result.partial);
    const errorsCount = Number(result.errorsCount ?? result.body.errors_count ?? 0);
    const ok = result.ok ?? (!partial && errorsCount === 0 && result.body.ok !== false);
    const status = statusFor(ok, partial, result.status);
    const body = {
      ok,
      route: options.route,
      durationMs: Date.now() - startedAtMs,
      ...(partial ? { partial: true } : {}),
      ...(Number.isFinite(errorsCount) ? { errors_count: errorsCount } : {}),
      ...(result.phase ? { phase: result.phase } : {}),
      ...result.body,
    };
    return applyResponseHeaders(NextResponse.json(body, { status, headers: result.headers }), options.responseHeaders);
  } catch (error) {
    return applyResponseHeaders(
      NextResponse.json(
        {
          ok: false,
          route: options.route,
          error: "Unexpected server error",
          code: "unhandled_internal",
          diagnostic_id: "route_unhandled_internal",
          phase: "handler",
          error_class: safeErrorClass(error),
          ...(safeErrorMessage(error) ? { error_message: safeErrorMessage(error) } : {}),
          durationMs: Date.now() - startedAtMs,
        },
        { status: 500 }
      ),
      options.responseHeaders
    );
  }
}

export function withRouteContract(options: ApiRouteRunnerOptions) {
  return async function routeHandler(request: Request) {
    return runApiRoute(request, options);
  };
}
