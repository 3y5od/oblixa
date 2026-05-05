import { NextResponse } from "next/server";
import { jsonProblem, type ProblemBody } from "@/lib/http/problem";

export type RouteFailurePhase =
  | "auth"
  | "rate_limit"
  | "idempotency"
  | "preflight"
  | "dependency_preflight"
  | "source_query"
  | "transform"
  | "persist"
  | "notify"
  | "refresh"
  | "handler"
  | "unknown";

export type RouteDependencyFailure = ProblemBody & {
  ok: false;
  phase: "dependency_preflight";
  details?: Record<string, unknown> & {
    dependency?: string;
    required_env?: string[];
    optional_env?: string[];
    degraded_policy?: string;
  };
};

export type BatchItemError = {
  scope: string;
  phase?: RouteFailurePhase;
  diagnostic_id?: string;
  message: string;
};

function redactMessage(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted_email]")
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted]")
    .replace(/\b(sk_(live|test)_[a-z0-9]+)\b/gi, "[redacted_secret]")
    .replace(/\b([A-Z0-9]{20,})\b/g, "[redacted_token]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function safeErrorClass(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "unknown";
}

export function safeErrorMessage(error: unknown, maxLen = 180): string | undefined {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const redacted = redactMessage(raw);
  if (!redacted) return undefined;
  return redacted.slice(0, maxLen);
}

export function safeErrorDetails(error: unknown): {
  phase: RouteFailurePhase;
  error_class: string;
  error_message?: string;
} {
  const error_message = safeErrorMessage(error);
  return {
    phase: "unknown",
    error_class: safeErrorClass(error),
    ...(error_message ? { error_message } : {}),
  };
}

export function jsonDependencyBlocked(input: {
  error: string;
  code?: string;
  diagnosticId: string;
  route?: string;
  dependency?: string;
  requiredEnv?: string[];
  optionalEnv?: string[];
  degradedPolicy?: string;
  details?: Record<string, unknown>;
  headers?: HeadersInit;
  status?: number;
}): NextResponse<RouteDependencyFailure> {
  const details: RouteDependencyFailure["details"] = {
    ...(input.dependency ? { dependency: input.dependency } : {}),
    ...(input.requiredEnv?.length ? { required_env: input.requiredEnv } : {}),
    ...(input.optionalEnv?.length ? { optional_env: input.optionalEnv } : {}),
    ...(input.degradedPolicy ? { degraded_policy: input.degradedPolicy } : {}),
    ...(input.details ?? {}),
  };
  return jsonProblem(
    input.status ?? 503,
    {
      ok: false,
      error: input.error,
      code: input.code ?? "dependency_blocked",
      diagnostic_id: input.diagnosticId,
      phase: "dependency_preflight",
      ...(input.route ? { route: input.route } : {}),
      ...(Object.keys(details).length > 0 ? { details } : {}),
    },
    { headers: input.headers }
  ) as NextResponse<RouteDependencyFailure>;
}

export async function executeBatch<T>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<"processed" | "skipped" | BatchItemError | void>
): Promise<{
  processed: number;
  skipped: number;
  failed: number;
  errors: BatchItemError[];
}> {
  let processed = 0;
  let skipped = 0;
  const errors: BatchItemError[] = [];
  for (const [index, item] of items.entries()) {
    const result = await worker(item, index);
    if (result === "skipped") {
      skipped += 1;
      continue;
    }
    if (result && typeof result === "object") {
      errors.push(result);
      continue;
    }
    processed += 1;
  }
  return { processed, skipped, failed: errors.length, errors };
}

export const runIsolatedBatch = executeBatch;
