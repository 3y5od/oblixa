export interface WithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export const RETRY_DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000;
export const RETRY_MAX_ATTEMPT_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAttemptTimeoutMs(timeoutMs: number | undefined): number {
  const value = timeoutMs ?? RETRY_DEFAULT_ATTEMPT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("retry: invalid timeout");
  }
  return Math.min(Math.floor(value), RETRY_MAX_ATTEMPT_TIMEOUT_MS);
}

function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`retry: operation timed out after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

function combineAbortSignals(user: AbortSignal | null | undefined, inner: AbortSignal): AbortSignal {
  if (!user) return inner;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (user.aborted || inner.aborted) {
    controller.abort();
    return controller.signal;
  }
  user.addEventListener("abort", onAbort, { once: true });
  inner.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

async function withAttemptTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(createTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const timeoutMs = normalizeAttemptTimeoutMs(options.timeoutMs);
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withAttemptTimeout(fn, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts || !shouldRetry(e, attempt)) {
        throw e;
      }
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Mirrors OpenAI SDK `APIConnectionError` / `APIError` checks without importing `openai`,
 * so modules that only need retry helpers do not pull the SDK into the graph.
 */
export function isRetryableOpenAIError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as Error).name;
  if (name === "APIConnectionError") return true;
  if (name === "APIError") {
    const s = (err as { status?: number }).status;
    if (typeof s === "number") return s === 429 || s >= 500;
  }
  return false;
}

/** Retries on 429 / 5xx; returns the last response (ok or not) when giving up. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: WithRetryOptions
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  const maxDelayMs = options?.maxDelayMs ?? 8000;
  const timeoutMs = normalizeAttemptTimeoutMs(options?.timeoutMs);
  const shouldRetry = options?.shouldRetry ?? (() => true);
  const { signal: userSignal, ...restInit } = init ?? {};

  let last: Response | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      last = await fetch(input, {
        ...restInit,
        signal: combineAbortSignals(userSignal, controller.signal),
      });
    } catch (e) {
      if (attempt === maxAttempts || !shouldRetry(e, attempt)) {
        throw e;
      }
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1) + Math.random() * 150
      );
      await sleep(delay);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
    if (last.ok) return last;
    const retryable =
      last.status === 429 ||
      last.status === 502 ||
      last.status === 503 ||
      last.status === 504;
    if (!retryable || attempt === maxAttempts) {
      return last;
    }
    const delay = Math.min(
      maxDelayMs,
      baseDelayMs * 2 ** (attempt - 1) + Math.random() * 150
    );
    await sleep(delay);
  }
  return last!;
}
