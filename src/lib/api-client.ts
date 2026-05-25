"use client";

import { interpretHttpMutationFailure } from "@/lib/api-client-errors";
import {
  buildV10MutationResponse,
  classifyV10MutationResponse,
  isV10MutationOutcome,
  validateV10ApiResponseSchema,
  type V10ApiResponseClass,
  type V10MutationResponse,
} from "./mutation-envelope";

export type V10BrowserMutationMethod = "POST" | "PATCH" | "DELETE";
export type V10BrowserRecoveryState =
  | "none"
  | "offline_retry"
  | "aborted_no_retry"
  | "stale_refresh_required"
  | "idempotent_replay"
  | "payload_conflict"
  | "validation_self_fix"
  | "terminal_support";

export type V10BrowserMutationInput = {
  url: string;
  method?: V10BrowserMutationMethod;
  body?: unknown;
  idempotencyKey?: string;
  clientRequestId?: string;
  expectedVersion?: string | number | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type V10BrowserMutationResult = {
  ok: boolean;
  status: number;
  response: V10MutationResponse;
  responseClass: V10ApiResponseClass;
  replayed: boolean;
  schemaFailures: readonly string[];
  retryAppropriate: boolean;
  userMessage: string;
  browserRecoveryState: V10BrowserRecoveryState;
};

function makeBrowserToken(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `${prefix}:${cryptoApi.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2);
  const now = Date.now().toString(36);
  return `${prefix}:${now}_${random}`;
}

export function createV10IdempotencyKey(): string {
  return makeBrowserToken("v10");
}

export function createV10ClientRequestId(): string {
  return makeBrowserToken("v10-client");
}

function isV10MutationResponse(value: unknown): value is V10MutationResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<V10MutationResponse>;
  return (
    typeof response.outcome === "string" &&
    isV10MutationOutcome(response.outcome) &&
    typeof response.user_visible_message === "string"
  );
}

function buildFallbackResponse(status: number, payload: unknown): V10MutationResponse {
  const message =
    payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : "Request failed.";
  const mapped = interpretHttpMutationFailure({ status, message });
  return buildV10MutationResponse({
    outcome: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : status === 429 ? "rate_limited" : "server_error",
    message: mapped.userMessage,
    diagnosticId: `v10_browser_http_${status}`,
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function getV10BrowserRecoveryState(input: {
  responseClass: V10ApiResponseClass;
  replayed?: boolean;
  replayState?: V10MutationResponse["replay_state"];
  validationFailureCount?: number;
  networkError?: boolean;
  aborted?: boolean;
}): V10BrowserRecoveryState {
  if (input.aborted) return "aborted_no_retry";
  if (input.networkError) return "offline_retry";
  if (input.replayed || input.responseClass === "idempotent") return "idempotent_replay";
  if (input.replayState === "payload_conflict") return "payload_conflict";
  if (input.responseClass === "stale") return "stale_refresh_required";
  if (input.responseClass === "validation" && (input.validationFailureCount ?? 0) > 0) return "validation_self_fix";
  if (input.responseClass === "terminal" || input.responseClass === "partial") return "terminal_support";
  return "none";
}

export async function mutateV10(input: V10BrowserMutationInput): Promise<V10BrowserMutationResult> {
  const headers = new Headers(input.headers);
  headers.set("Accept", "application/json");
  headers.set("Cache-Control", "no-store");
  headers.set("x-idempotency-key", input.idempotencyKey ?? createV10IdempotencyKey());
  headers.set("x-client-request-id", input.clientRequestId ?? createV10ClientRequestId());
  if (input.expectedVersion !== null && input.expectedVersion !== undefined) {
    headers.set("x-v10-expected-version", String(input.expectedVersion));
  }
  const hasBody = input.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(input.url, {
      method: input.method ?? "POST",
      credentials: "same-origin",
      headers,
      body: hasBody ? JSON.stringify(input.body) : undefined,
      signal: input.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    const envelope = buildV10MutationResponse({
      outcome: "server_error",
      message: aborted
        ? "Request was canceled before it completed."
        : "Network error. Check your connection and retry when the connection is stable.",
      diagnosticId: aborted ? "v10_browser_request_aborted" : "v10_browser_network_error",
    });
    const responseClass = classifyV10MutationResponse(envelope);
    return {
      ok: false,
      status: 0,
      response: envelope,
      responseClass,
      replayed: false,
      schemaFailures: validateV10ApiResponseSchema(envelope),
      retryAppropriate: !aborted,
      userMessage: envelope.user_visible_message,
      browserRecoveryState: getV10BrowserRecoveryState({ responseClass, networkError: !aborted, aborted }),
    };
  }

  const payload = await readJson(response);
  const replayed = response.headers.get("x-v10-idempotent-replay") === "true";
  const envelope = isV10MutationResponse(payload) ? payload : buildFallbackResponse(response.status, payload);
  const responseClass = classifyV10MutationResponse(envelope, replayed);
  const schemaFailures = validateV10ApiResponseSchema(envelope, { replayed });
  const fallback = interpretHttpMutationFailure({
    status: response.status,
    message: envelope.user_visible_message,
  });

  return {
    ok: response.ok && schemaFailures.length === 0 && envelope.outcome === "success",
    status: response.status,
    response: envelope,
    responseClass,
    replayed,
    schemaFailures,
    retryAppropriate: responseClass === "retryable" || responseClass === "stale" || fallback.retryAppropriate,
    userMessage: envelope.user_visible_message || fallback.userMessage,
    browserRecoveryState: getV10BrowserRecoveryState({
      responseClass,
      replayed,
      replayState: envelope.replay_state,
      validationFailureCount: envelope.validation_failures?.length,
    }),
  };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { createV10ClientRequestId as createClientRequestId };
export { createV10IdempotencyKey as createIdempotencyKey };
export { getV10BrowserRecoveryState as getBrowserRecoveryState };
export type { V10BrowserMutationInput as BrowserMutationInput };
export type { V10BrowserMutationMethod as BrowserMutationMethod };
export type { V10BrowserMutationResult as BrowserMutationResult };
export type { V10BrowserRecoveryState as BrowserRecoveryState };
// End version-name compatibility aliases.
