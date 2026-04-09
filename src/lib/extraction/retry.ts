export interface WithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
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

  let last: Response | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await fetch(input, init);
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
