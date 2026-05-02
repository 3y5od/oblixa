import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

const REQUEST_ID = "x-request-id";
const CORRELATION_ID = "x-correlation-id";
const MAX_HEADER_LEN = 128;

function sanitizeHeaderValue(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\r\n\0]/g, "").trim().slice(0, MAX_HEADER_LEN);
  return t.length > 0 ? t : null;
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type CorrelationIds = { requestId: string; correlationId: string };

/** Resolve or mint correlation ids from the incoming edge request (no logging). */
export function resolveCorrelationIds(request: NextRequest): CorrelationIds {
  const existingReq = sanitizeHeaderValue(request.headers.get(REQUEST_ID));
  const existingCorr = sanitizeHeaderValue(request.headers.get(CORRELATION_ID));
  const requestId = existingReq ?? newRequestId();
  const correlationId = existingCorr ?? requestId;
  return { requestId, correlationId };
}

/** Stamp response headers for downstream proxies and browser tooling. */
export function applyCorrelationHeadersToResponse(res: NextResponse, ids: CorrelationIds): NextResponse {
  res.headers.set(REQUEST_ID, ids.requestId);
  res.headers.set(CORRELATION_ID, ids.correlationId);
  return res;
}
