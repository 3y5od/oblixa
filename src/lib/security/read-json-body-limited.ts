import { NextResponse } from "next/server";
import { jsonBadRequest, jsonPayloadTooLarge, jsonUnsupportedMediaType } from "@/lib/http/problem";
import { jsonContentTypeRejection } from "@/lib/security/json-content-type";
import { hasUnsafeJsonKey, isJsonShapeWithinLimits } from "@/lib/security/validation";

const DEFAULT_MAX = 512 * 1024;
export const BODY_LIMIT_SMALL_JSON = 32 * 1024;
export const BODY_LIMIT_MEDIUM_JSON = 256 * 1024;
export const BODY_LIMIT_LARGE_JSON = 1024 * 1024;
export const BODY_LIMIT_STRICT_INBOUND = 256 * 1024;

const JSON_SHAPE_LIMITS = {
  maxDepth: 32,
  maxArrayLength: 10_000,
  maxKeys: 1_000,
};

function payloadTooLargeResponse(): NextResponse {
  return jsonPayloadTooLarge();
}

function invalidContentLengthResponse(): NextResponse {
  return jsonBadRequest(undefined, { reason: "invalid_content_length" });
}

function unexpectedBodyResponse(): NextResponse {
  return jsonBadRequest(undefined, { reason: "unexpected_request_body" });
}

/**
 * Rejects request bodies on mutation routes that intentionally do not accept input.
 * This closes the "bodyless mutation silently accepts attacker-controlled bytes" gap.
 */
export async function rejectUnexpectedBody(request?: Request | null): Promise<NextResponse | null> {
  if (!request) return null;

  const len = request.headers.get("content-length");
  if (len) {
    if (!/^\d+$/.test(len.trim())) {
      return invalidContentLengthResponse();
    }
    const n = Number(len);
    if (!Number.isSafeInteger(n)) return invalidContentLengthResponse();
    if (n > 0) return unexpectedBodyResponse();
  }

  if (!request.body) return null;

  const reader = request.body.getReader();
  const first = await reader.read();
  if (first.done) return null;
  await reader.cancel().catch(() => undefined);
  return unexpectedBodyResponse();
}

function parseJsonTextLimited(
  text: string,
  maxBytes: number
): { ok: true; body: unknown } | { ok: false; response: NextResponse } {
  try {
    const body = text ? JSON.parse(text) : null;
    if (hasUnsafeJsonKey(body)) {
      return {
        ok: false,
        response: jsonBadRequest(undefined, { reason: "unsafe_json_key" }),
      };
    }
    if (!isJsonShapeWithinLimits(body, { ...JSON_SHAPE_LIMITS, maxStringLength: maxBytes, allowJsonWhitespaceControls: true })) {
      return {
        ok: false,
        response: jsonBadRequest(undefined, { reason: "json_shape_too_large" }),
      };
    }
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: jsonBadRequest(undefined, { reason: "invalid_json" }),
    };
  }
}

/** Read JSON body capped by declared and actual byte count, preserving raw text for signatures. */
export async function readJsonBodyLimitedWithRaw(
  request: Request,
  maxBytes: number = DEFAULT_MAX
): Promise<{ ok: true; body: unknown; rawBody: string } | { ok: false; response: NextResponse }> {
  const contentTypeRejection = jsonContentTypeRejection(request);
  if (contentTypeRejection) {
    return {
      ok: false,
      response: jsonUnsupportedMediaType(undefined, contentTypeRejection.details),
    };
  }
  const res = await readTextBodyLimited(request, maxBytes);
  if (!res.ok) return res;
  const parsed = parseJsonTextLimited(res.body, maxBytes);
  if (!parsed.ok) return parsed;
  return { ok: true, body: parsed.body, rawBody: res.body };
}

/** Read JSON body capped by declared and actual byte count. */
export async function readJsonBodyLimited(
  request: Request,
  maxBytes: number = DEFAULT_MAX
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const res = await readJsonBodyLimitedWithRaw(request, maxBytes);
  if (!res.ok) return res;
  return { ok: true, body: res.body };
}

export async function readTextBodyLimited(
  request: Request,
  maxBytes: number = DEFAULT_MAX
): Promise<{ ok: true; body: string } | { ok: false; response: NextResponse }> {
  const len = request.headers.get("content-length");
  if (len) {
    if (!/^\d+$/.test(len.trim())) {
      return { ok: false, response: invalidContentLengthResponse() };
    }
    const n = Number(len);
    if (!Number.isSafeInteger(n) || n > maxBytes) return { ok: false, response: payloadTooLargeResponse() };
  }

  if (!request.body) return { ok: true, body: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, response: payloadTooLargeResponse() };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { ok: true, body: text };
}

/**
 * Read size-limited JSON then map through `parse` (e.g. `readJsonBody` from v5/api).
 * Returns a NextResponse on size/parse errors, otherwise `{ ok: true, data }`.
 */
export async function parseJsonBodyWithLimit<T>(
  request: Request,
  parse: (raw: unknown) => T,
  maxBytes?: number
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const res = await readJsonBodyLimited(request, maxBytes);
  if (!res.ok) return res;
  return { ok: true, data: parse(res.body) };
}
