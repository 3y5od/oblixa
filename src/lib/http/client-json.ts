/**
 * Browser-safe helpers for fetch + JSON responses from same-origin `/api/*` routes.
 */

export type ReadJsonResult =
  | { ok: true; data: unknown; status: number }
  | { ok: false; message: string; status: number };

export type JsonMutationResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; message: string; status: number; data: null };

/** Shown when the server returns 401/403 and no JSON error string. */
export const SESSION_OR_AUTH_MESSAGE =
  "Your session may have expired, or you may not have access. Try signing in again.";

function extractErrorMessage(data: unknown): string | null {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  }
  return null;
}

function fallbackMessageForStatus(status: number, statusText: string): string {
  if (status === 401 || status === 403) return SESSION_OR_AUTH_MESSAGE;
  const fromApi = statusText?.trim();
  if (fromApi) return fromApi;
  if (status >= 500) return "Something went wrong on our end. Try again in a moment.";
  return "Request failed.";
}

/**
 * Reads a Response body as JSON when possible. Does not throw on parse errors or empty bodies.
 * For 204 / empty successful bodies, returns `{ ok: true, data: null }`.
 */
export async function readResponseJson(res: Response): Promise<ReadJsonResult> {
  const status = res.status;
  let text: string;
  try {
    text = await res.text();
  } catch {
    return {
      ok: false,
      message: res.ok ? "Could not read response." : fallbackMessageForStatus(status, res.statusText),
      status,
    };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    if (res.ok) {
      return { ok: true, data: null, status };
    }
    return {
      ok: false,
      message: fallbackMessageForStatus(status, res.statusText),
      status,
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed) as unknown;
  } catch {
    if (res.ok) {
      return { ok: false, message: "Invalid response from server.", status };
    }
    return {
      ok: false,
      message: fallbackMessageForStatus(status, res.statusText),
      status,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      message: extractErrorMessage(data) ?? fallbackMessageForStatus(status, res.statusText),
      status,
    };
  }

  return { ok: true, data, status };
}

export function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Same-origin fetch with JSON parsing via {@link readResponseJson}.
 * Network failures throw (callers should catch and show a message + optional Sentry).
 */
export async function fetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<ReadJsonResult> {
  const timeoutMs = 20_000;
  const nextInit: RequestInit = {
    credentials: "same-origin",
    ...init,
  };
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let res: Response;
  if (nextInit.signal) {
    res = await fetch(input, nextInit);
  } else {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    res = await fetch(input, { ...nextInit, signal: controller.signal });
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  return readResponseJson(res);
}

export async function mutateJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<JsonMutationResult<T>> {
  try {
    const result = await fetchJson(input, init);
    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status, data: null };
    }
    return { ok: true, data: result.data as T, status: result.status };
  } catch {
    return {
      ok: false,
      message: "Network error. Check your connection and retry.",
      status: 0,
      data: null,
    };
  }
}

export function sendJsonKeepalive(input: RequestInfo | URL, body: string): void {
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(input, blob)) return;
  }

  void fetch(input, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}
