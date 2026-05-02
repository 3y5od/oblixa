import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { runExtractionPipeline } from "@/lib/extraction/run-pipeline";
import {
  getClientIpFromRequest,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { enforceIdempotency } from "@/lib/idempotency";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { isUuid } from "@/lib/security/validation";

/**
 * Isolated invocation for extraction (separate from POST /api/extract request lifecycle).
 * `maxDuration` should match the host’s serverless cap; large PDFs + OpenAI may need
 * this worker on a separate origin or queue if the platform times out earlier.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(
    `extract-worker:${ip}`,
    RATE_LIMITS.extractWorker
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }

  const secret = process.env.EXTRACTION_WORKER_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Worker not configured" },
      { status: 503 }
    );
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !secureCompareUtf8(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const _lim = await readJsonBodyLimited(request);
  if (!_lim.ok) return _lim.response;
  const body = _lim.body;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const contractId = String((body as { contractId?: unknown }).contractId ?? "").trim();
  const userId = String((body as { userId?: unknown }).userId ?? "").trim();
  const organizationId = String(
    (body as { organizationId?: unknown }).organizationId ?? ""
  ).trim();

  if (!contractId || !userId || !organizationId) {
    return NextResponse.json(
      { error: "contractId, userId, and organizationId required" },
      { status: 400 }
    );
  }

  if (!isUuid(contractId) || !isUuid(userId) || !isUuid(organizationId)) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  const duplicate = await enforceIdempotency(request, {
    scope: "extract-worker",
    actorKey: `${organizationId}:${contractId}`,
  });
  if (duplicate) return duplicate;

  try {
    await runExtractionPipeline({
      contractId,
      userId,
      organizationId,
    });
  } catch (err) {
    console.error("[api/extract/run] pipeline error:", err);
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
