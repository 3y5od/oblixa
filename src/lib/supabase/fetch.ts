export const SUPABASE_PROXY_FETCH_TIMEOUT_MS = 2_000;
export const SUPABASE_SERVER_FETCH_TIMEOUT_MS = 8_000;
export const SUPABASE_BROWSER_FETCH_TIMEOUT_MS = 8_000;
export const SUPABASE_AUTH_UNAVAILABLE_STATUS = 503;

export function combineSupabaseAbortSignals(
  user: AbortSignal | null | undefined,
  inner: AbortSignal
): AbortSignal {
  if (!user) return inner;
  if (user.aborted) return user;
  const controller = new AbortController();
  const abort = () => controller.abort();
  user.addEventListener("abort", abort, { once: true });
  inner.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

export function normalizeSupabaseFetchInput(
  input: Parameters<typeof fetch>[0]
): string | URL {
  if (typeof input === "string" || input instanceof URL) return input;
  return input.url;
}

export function normalizeSupabaseFetchInit(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): RequestInit {
  if (!(input instanceof Request)) return init ?? {};
  return {
    method: input.method,
    headers: init?.headers ?? input.headers,
    body: init?.body ?? input.body,
    signal: init?.signal ?? input.signal,
    ...init,
  };
}

export function createSupabaseTimeoutFetch(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const normalizedInit = normalizeSupabaseFetchInit(input, init);
      return await fetch(input, { // security:fetch-allowlist SEC-supabase-auth-timeout trusted Supabase env URL; timeout-bounded
        ...normalizedInit,
        signal: combineSupabaseAbortSignals(normalizedInit.signal, controller.signal),
      });
    } catch (error) {
      if (isTransientSupabaseFetchFailure(error)) {
        return buildSupabaseUnavailableResponse();
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function buildSupabaseUnavailableResponse(): Response {
  return new Response("Supabase Auth unavailable", {
    status: SUPABASE_AUTH_UNAVAILABLE_STATUS,
    statusText: "Service Unavailable",
  });
}

export function isTransientSupabaseFetchFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name).toLowerCase() : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  const cause = "cause" in error && error.cause && typeof error.cause === "object"
    ? error.cause
    : null;
  const causeCode = cause && "code" in cause ? String(cause.code).toLowerCase() : "";
  const causeMessage = cause && "message" in cause ? String(cause.message).toLowerCase() : "";
  const combined = `${name} ${message} ${causeCode} ${causeMessage}`;
  return (
    combined.includes("aborterror") ||
    combined.includes("fetch failed") ||
    combined.includes("econnrefused") ||
    combined.includes("econnreset") ||
    combined.includes("enetunreach") ||
    combined.includes("etimedout") ||
    combined.includes("enotfound")
  );
}
