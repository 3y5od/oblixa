import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchWithRetry, withRetry } from "@/lib/extraction/retry";

describe("withRetry", () => {
  it("returns on first success", async () => {
    let n = 0;
    const r = await withRetry(async () => {
      n++;
      return "a";
    });
    expect(r).toBe("a");
    expect(n).toBe(1);
  });

  it("retries then succeeds", async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n++;
        if (n < 3) throw new Error("transient");
        return "ok";
      },
      { maxAttempts: 5, shouldRetry: () => true }
    );
    expect(r).toBe("ok");
    expect(n).toBe(3);
  });

  it("stops when shouldRetry is false", async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n++;
          throw new Error("no");
        },
        {
          maxAttempts: 5,
          shouldRetry: () => false,
        }
      )
    ).rejects.toThrow("no");
    expect(n).toBe(1);
  });
});

describe("fetchWithRetry", () => {
  const orig = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = orig;
    vi.restoreAllMocks();
  });

  it("retries on 503 then returns ok response", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls < 2) {
        return new Response("bad", { status: 503 });
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await fetchWithRetry("http://example.test/run", {});
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("ok");
    expect(calls).toBe(2);
  });

  it("returns a non-retryable error response without retrying", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return new Response("nope", { status: 400 });
    }) as typeof fetch;

    const res = await fetchWithRetry("http://example.test/run", {});
    expect(res.status).toBe(400);
    expect(calls).toBe(1);
  });
});
