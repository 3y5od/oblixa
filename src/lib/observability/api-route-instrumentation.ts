import { NextResponse } from "next/server";
import { captureServerException } from "@/lib/observability/sentry";
import { PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";

export type RouteHandler<TArgs extends unknown[]> = (...args: TArgs) => Promise<Response> | Response;

const ROUTE_ID_HEADER = "x-oblixa-route-id";
const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";
const DURATION_HEADER = "x-oblixa-route-duration-ms";
const STATUS_CLASS_HEADER = "x-oblixa-route-status-class";
const ERROR_CLASS_HEADER = "x-oblixa-error-class";
const MAX_HEADER_LENGTH = 128;

function sanitizeHeader(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.replace(/[\r\n\0]/g, "").trim().slice(0, MAX_HEADER_LENGTH);
  return value || null;
}

function requestFromArgs(args: readonly unknown[]): Request | null {
  return args.find((arg): arg is Request => arg instanceof Request) ?? null;
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveIds(request: Request | null) {
  const requestId = sanitizeHeader(request?.headers.get(REQUEST_ID_HEADER) ?? null) ?? newRequestId();
  const correlationId = sanitizeHeader(request?.headers.get(CORRELATION_ID_HEADER) ?? null) ?? requestId;
  return { requestId, correlationId };
}

function statusClass(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "1xx";
}

function safeErrorClass(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function applyHeaders(
  response: Response,
  routeId: string,
  ids: { requestId: string; correlationId: string },
  startedAtMs: number,
  errorClass?: string
): Response {
  const durationMs = Math.max(0, Date.now() - startedAtMs);
  const headers = new Headers(response.headers);
  headers.set(ROUTE_ID_HEADER, routeId);
  headers.set(REQUEST_ID_HEADER, ids.requestId);
  headers.set(CORRELATION_ID_HEADER, ids.correlationId);
  headers.set(DURATION_HEADER, String(durationMs));
  headers.set(STATUS_CLASS_HEADER, statusClass(response.status));
  if (errorClass) headers.set(ERROR_CLASS_HEADER, errorClass);
  if (routeId.startsWith("/api/")) {
    for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
      if (!headers.has(key)) headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Wrap a handler with stable route telemetry while preserving successful response bodies. */
export function withApiRouteTelemetry<TArgs extends unknown[]>(
  routeId: string,
  handler: RouteHandler<TArgs>
): RouteHandler<TArgs> {
  return async (...args: TArgs) => {
    const startedAtMs = Date.now();
    const ids = resolveIds(requestFromArgs(args));
    try {
      const response = await handler(...args);
      return applyHeaders(response, routeId, ids, startedAtMs);
    } catch (error) {
      const errorClass = safeErrorClass(error);
      captureServerException(error, {
        tags: { route_id: routeId, error_class: errorClass },
        extra: { route: routeId, request_id: ids.requestId, correlation_id: ids.correlationId },
      });
      const response = NextResponse.json(
        {
          error: "Unexpected server error",
          code: "unexpected_server_error",
          diagnostic_id: "route_unhandled_error",
          route: routeId,
          request_id: ids.requestId,
        },
        { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
      );
      return applyHeaders(response, routeId, ids, startedAtMs, errorClass);
    }
  };
}

export function jsonWithRouteId(routeId: string, body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set(ROUTE_ID_HEADER, routeId);
  return NextResponse.json(body, { ...init, headers });
}
