/**
 * Bounded server-side fetch: timeout, response size cap, redirect limit.
 * Use for outbound integration and webhook-style calls (defense in depth vs SSRF abuse).
 */
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export type SafeFetchOptions = RequestInit & {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export async function safeFetch(input: RequestInfo | URL, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    ...init
  } = options;

  let url = typeof input === "string" || input instanceof URL ? String(input) : (input as Request).url;
  let redirectCount = 0;

  for (;;) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (e) {
      clearTimeout(t);
      const msg = e instanceof Error ? e.message : String(e);
      throw new SafeFetchError(`fetch failed: ${msg}`);
    }
    clearTimeout(t);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || redirectCount >= maxRedirects) {
        throw new SafeFetchError("redirect limit exceeded or missing Location");
      }
      redirectCount++;
      url = new URL(loc, url).toString();
      continue;
    }

    if (!res.body) return res;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            reader.cancel().catch(() => undefined);
            throw new SafeFetchError(`response exceeded maxBytes (${maxBytes})`);
          }
          chunks.push(value);
        }
      }
    } catch (e) {
      if (e instanceof SafeFetchError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new SafeFetchError(`read failed: ${msg}`);
    }

    const blob = new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") ?? undefined });
    return new Response(blob, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }
}
