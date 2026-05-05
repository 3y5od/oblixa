import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/security/cron-route-gate";
import { createAdminClient } from "@/lib/supabase/server";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";
import { enforceIdempotency } from "@/lib/idempotency";
import {
  safeErrorClass,
  safeErrorMessage,
  type RouteFailurePhase,
} from "@/lib/route-runtime-contract";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type RateLimitConfig = (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];

export type CronRouteHandlerContext = {
  request: Request;
  startedAtMs: number;
  admin: AdminClient;
};

export type CronRouteHandlerResult = {
  body: Record<string, unknown>;
  status?: number;
  ok?: boolean;
  partial?: boolean;
  errorsCount?: number;
  pingReason?: string;
  phase?: RouteFailurePhase;
};

export type CronRouteDependencyPreflightResult = {
  error: string;
  code?: string;
  diagnostic_id: string;
  status?: number;
  phase?: RouteFailurePhase;
  details?: Record<string, unknown>;
};

export type CronRouteRunnerOptions = {
  route: string;
  healthcheckRoute?: string;
  rateLimitKey: string | ((request: Request) => Promise<string> | string);
  rateLimit?: RateLimitConfig;
  responseHeaders?: HeadersInit;
  preflight?: (request: Request) => Promise<NextResponse | null> | NextResponse | null;
  dependencyPreflight?: (
    request: Request
  ) => Promise<CronRouteDependencyPreflightResult | null> | CronRouteDependencyPreflightResult | null;
  handler: (ctx: CronRouteHandlerContext) => Promise<CronRouteHandlerResult | Record<string, unknown>>;
  adminFactory?: () => Promise<AdminClient>;
  pingHealthcheck?: boolean;
};

function normalizeHandlerResult(result: CronRouteHandlerResult | Record<string, unknown>): CronRouteHandlerResult {
  if ("body" in result && typeof result.body === "object" && result.body !== null) {
    return result as CronRouteHandlerResult;
  }
  return { body: result as Record<string, unknown> };
}

function statusFor(ok: boolean, partial: boolean, explicit?: number): number {
  if (explicit) return explicit;
  if (partial) return 207;
  return ok ? 200 : 500;
}

function pingIfEnabled(options: CronRouteRunnerOptions, payload: Record<string, unknown>) {
  if (options.pingHealthcheck === false) return;
  pingCronHealthcheck(options.healthcheckRoute ?? options.route, payload);
}

function getSkipTelemetryFromBody(body: Record<string, unknown>) {
  const skipped = body.skipped === true;
  const skipReason = typeof body.reason === "string" ? body.reason : undefined;
  return {
    skipped,
    ...(skipped ? { skipped: true } : {}),
    ...(skipped && skipReason ? { skip_reason: skipReason } : {}),
  };
}

async function getSkipTelemetryFromResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/application\/json/i.test(contentType)) return {};
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    const telemetry = getSkipTelemetryFromBody(body);
    return telemetry.skipped ? telemetry : {};
  } catch {
    return {};
  }
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

export async function runCronRoute(request: Request, options: CronRouteRunnerOptions): Promise<NextResponse> {
  const startedAtMs = Date.now();
  const deny = gateCronRequest(request, { headers: options.responseHeaders });
  if (deny) {
    pingIfEnabled(options, {
      ok: false,
      status: deny.status,
      reason: deny.status === 503 ? "cron_secret_missing" : "cron_unauthorized",
      durationMs: Date.now() - startedAtMs,
    });
    return deny;
  }

  const duplicate = await enforceIdempotency(request, {
    scope: `cron:${options.route}`,
    actorKey: "cron",
  });
  if (duplicate) {
    pingIfEnabled(options, {
      ok: false,
      status: duplicate.status,
      reason: "duplicate_request",
      durationMs: Date.now() - startedAtMs,
    });
    return applyResponseHeaders(duplicate, options.responseHeaders);
  }

  const rateLimitKey =
    typeof options.rateLimitKey === "function" ? await options.rateLimitKey(request) : options.rateLimitKey;
  const rate = await rateLimitCheck(rateLimitKey, options.rateLimit ?? RATE_LIMITS.v6CronDefault);
  if (!rate.ok) {
    const payload = {
      ok: false,
      route: options.route,
      error: "Too many requests",
      code: "rate_limited",
      diagnostic_id: "cron_rate_limited",
      retryAfterMs: rate.retryAfterMs,
      durationMs: Date.now() - startedAtMs,
    };
    pingIfEnabled(options, { ...payload, status: 429, reason: "rate_limited" });
    return applyResponseHeaders(NextResponse.json(payload, { status: 429 }), options.responseHeaders);
  }

  const preflight = options.preflight ? await options.preflight(request) : null;
  const dependencyPreflight = options.dependencyPreflight ? await options.dependencyPreflight(request) : null;
  if (dependencyPreflight) {
    const payload = {
      ok: false,
      route: options.route,
      error: dependencyPreflight.error,
      code: dependencyPreflight.code ?? "dependency_blocked",
      diagnostic_id: dependencyPreflight.diagnostic_id,
      phase: dependencyPreflight.phase ?? "dependency_preflight",
      durationMs: Date.now() - startedAtMs,
      ...(dependencyPreflight.details ? { details: dependencyPreflight.details } : {}),
    };
    pingIfEnabled(options, {
      ...payload,
      status: dependencyPreflight.status ?? 503,
      reason: dependencyPreflight.code ?? "dependency_blocked",
    });
    return applyResponseHeaders(
      NextResponse.json(payload, { status: dependencyPreflight.status ?? 503 }),
      options.responseHeaders
    );
  }
  if (preflight) {
    const skipTelemetry = await getSkipTelemetryFromResponse(preflight);
    applyResponseHeaders(preflight, options.responseHeaders);
    pingIfEnabled(options, {
      ok: preflight.status < 400,
      status: preflight.status,
      reason:
        skipTelemetry.skipped === true
          ? "skipped"
          : preflight.status < 400
            ? "preflight"
            : "preflight_blocked",
      durationMs: Date.now() - startedAtMs,
      ...skipTelemetry,
    });
    return preflight;
  }

  let admin: AdminClient;
  try {
    admin = options.adminFactory ? await options.adminFactory() : await createAdminClient();
  } catch (error) {
    const payload = {
      ok: false,
      route: options.route,
      code: "admin_client_unavailable",
      diagnostic_id: "cron_admin_client_unavailable",
      phase: "preflight",
      error_class: safeErrorClass(error),
      ...(safeErrorMessage(error) ? { error_message: safeErrorMessage(error) } : {}),
      durationMs: Date.now() - startedAtMs,
    };
    pingIfEnabled(options, { ...payload, status: 503, reason: "admin_client_unavailable" });
    return applyResponseHeaders(NextResponse.json(payload, { status: 503 }), options.responseHeaders);
  }

  try {
    const result = normalizeHandlerResult(await options.handler({ request, startedAtMs, admin }));
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
    const skipTelemetry = getSkipTelemetryFromBody(body);
    pingIfEnabled(options, {
      ok,
      status,
      reason: result.pingReason ?? (skipTelemetry.skipped ? "skipped" : partial ? "partial" : ok ? "ok" : "failed"),
      durationMs: body.durationMs,
      errors_count: body.errors_count,
      ...skipTelemetry,
    });
    return applyResponseHeaders(NextResponse.json(body, { status }), options.responseHeaders);
  } catch (error) {
    const payload = {
      ok: false,
      route: options.route,
      code: "unhandled_cron_error",
      diagnostic_id: "cron_unhandled_error",
      phase: "handler",
      error_class: safeErrorClass(error),
      ...(safeErrorMessage(error) ? { error_message: safeErrorMessage(error) } : {}),
      durationMs: Date.now() - startedAtMs,
      errors_count: 1,
    };
    pingIfEnabled(options, { ...payload, status: 500, reason: "unhandled_cron_error" });
    return applyResponseHeaders(NextResponse.json(payload, { status: 500 }), options.responseHeaders);
  }
}

export function withCronRoute(options: CronRouteRunnerOptions) {
  return async function cronRouteGET(request: Request) {
    return runCronRoute(request, options);
  };
}