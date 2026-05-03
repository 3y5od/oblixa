import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/security/cron-route-gate";
import { createAdminClient } from "@/lib/supabase/server";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";

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
};

export type CronRouteRunnerOptions = {
  route: string;
  rateLimitKey: string | ((request: Request) => Promise<string> | string);
  rateLimit?: RateLimitConfig;
  preflight?: (request: Request) => Promise<NextResponse | null> | NextResponse | null;
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

function safeErrorClass(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function pingIfEnabled(options: CronRouteRunnerOptions, payload: Record<string, unknown>) {
  if (options.pingHealthcheck === false) return;
  pingCronHealthcheck(options.route, payload);
}

function applyNoStore(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function runCronRoute(request: Request, options: CronRouteRunnerOptions): Promise<NextResponse> {
  const startedAtMs = Date.now();
  const deny = gateCronRequest(request, { headers: PRIVATE_NO_STORE_HEADERS });
  if (deny) {
    pingIfEnabled(options, {
      ok: false,
      status: deny.status,
      reason: deny.status === 503 ? "cron_secret_missing" : "cron_unauthorized",
      durationMs: Date.now() - startedAtMs,
    });
    return deny;
  }

  const rateLimitKey =
    typeof options.rateLimitKey === "function" ? await options.rateLimitKey(request) : options.rateLimitKey;
  const rate = await rateLimitCheck(rateLimitKey, options.rateLimit ?? RATE_LIMITS.v6CronDefault);
  if (!rate.ok) {
    const payload = {
      ok: false,
      route: options.route,
      code: "rate_limited",
      diagnostic_id: "cron_rate_limited",
      retryAfterMs: rate.retryAfterMs,
      durationMs: Date.now() - startedAtMs,
    };
    pingIfEnabled(options, { ...payload, status: 429, reason: "rate_limited" });
    return NextResponse.json(payload, { status: 429, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const preflight = options.preflight ? await options.preflight(request) : null;
  if (preflight) {
    applyNoStore(preflight);
    pingIfEnabled(options, {
      ok: preflight.status < 400,
      status: preflight.status,
      reason: preflight.status < 400 ? "preflight" : "preflight_blocked",
      durationMs: Date.now() - startedAtMs,
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
      error_class: safeErrorClass(error),
      durationMs: Date.now() - startedAtMs,
    };
    pingIfEnabled(options, { ...payload, status: 503, reason: "admin_client_unavailable" });
    return NextResponse.json(payload, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
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
      ...result.body,
    };
    pingIfEnabled(options, {
      ok,
      status,
      reason: partial ? "partial" : ok ? "ok" : "failed",
      durationMs: body.durationMs,
      errors_count: body.errors_count,
    });
    return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const payload = {
      ok: false,
      route: options.route,
      code: "unhandled_cron_error",
      diagnostic_id: "cron_unhandled_error",
      error_class: safeErrorClass(error),
      durationMs: Date.now() - startedAtMs,
      errors_count: 1,
    };
    pingIfEnabled(options, { ...payload, status: 500, reason: "unhandled_cron_error" });
    return NextResponse.json(payload, { status: 500, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export function withCronRoute(options: CronRouteRunnerOptions) {
  return async function cronRouteGET(request: Request) {
    return runCronRoute(request, options);
  };
}