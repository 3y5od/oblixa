import { NextResponse } from "next/server";
import { API_PRIVATE_NO_STORE_HEADERS } from "@/lib/security/api-guards";

const DEFAULT_MAX = 512 * 1024;

/** Read JSON body capped by Content-Length when present, else default max bytes. */
export async function readJsonBodyLimited(
  request: Request,
  maxBytes: number = DEFAULT_MAX
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const len = request.headers.get("content-length");
  if (len) {
    const n = Number(len);
    if (Number.isFinite(n) && n > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Payload too large" },
          { status: 413, headers: API_PRIVATE_NO_STORE_HEADERS }
        ),
      };
    }
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payload too large" },
        { status: 413, headers: API_PRIVATE_NO_STORE_HEADERS }
      ),
    };
  }
  try {
    return { ok: true, body: text ? JSON.parse(text) : null };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400, headers: API_PRIVATE_NO_STORE_HEADERS }
      ),
    };
  }
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
