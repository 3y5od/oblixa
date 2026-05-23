import { NextResponse } from "next/server";

export const API_RESPONSE_LIMIT_SMALL_JSON = 64 * 1024;
export const API_RESPONSE_LIMIT_LARGE_JSON = 1024 * 1024;

const encoder = new TextEncoder();

export function encodedJsonSizeBytes(payload: unknown): number {
  return encoder.encode(JSON.stringify(payload)).byteLength;
}

export function jsonResponseWithSizeLimit(
  payload: unknown,
  options: {
    maxBytes: number;
    route: string;
    headers?: HeadersInit;
    status?: number;
  }
): NextResponse {
  const sizeBytes = encodedJsonSizeBytes(payload);
  if (sizeBytes > options.maxBytes) {
    return NextResponse.json(
      {
        error: "Response too large",
        code: "response_too_large",
        diagnostic_id: "api_response_size_limit_exceeded",
        route: options.route,
      },
      {
        status: 413,
        headers: {
          "Cache-Control": "private, no-store",
          ...options.headers,
        },
      }
    );
  }
  return NextResponse.json(payload, {
    status: options.status,
    headers: options.headers,
  });
}
