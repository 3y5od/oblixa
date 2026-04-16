import { NextResponse } from "next/server";
import { rateLimitCheck } from "@/lib/rate-limit";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_\-]{8,200}$/;

function readIdempotencyHeader(request: Request): string | null {
  const raw = request.headers.get("x-idempotency-key")?.trim() ?? "";
  if (!raw) return null;
  if (!IDEMPOTENCY_KEY_RE.test(raw)) return "__invalid__";
  return raw;
}

export async function enforceIdempotency(request: Request, input: { scope: string; actorKey: string }) {
  const key = readIdempotencyHeader(request);
  if (!key) return null;
  if (key === "__invalid__") {
    return NextResponse.json(
      { error: "Invalid x-idempotency-key. Use 8-200 chars [A-Za-z0-9:_-]." },
      { status: 400 }
    );
  }
  const limiterKey = `idem:${input.scope}:${input.actorKey}:${key}`;
  const result = await rateLimitCheck(limiterKey, { max: 1, windowMs: 10 * 60_000 });
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Duplicate request blocked by idempotency key", retryAfterMs: result.retryAfterMs },
    {
      status: 409,
      headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) },
    }
  );
}
