import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, withRetry } from "./retry";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withRetry timeout budgets", () => {
  it("rejects an attempt that exceeds its timeout budget", async () => {
    await expect(
      withRetry(() => new Promise(() => undefined), {
        maxAttempts: 1,
        timeoutMs: 5,
      })
    ).rejects.toThrow("operation timed out");
  });

  it("retries timed-out attempts up to the attempt cap", async () => {
    const worker = vi.fn(() => new Promise(() => undefined));

    await expect(
      withRetry(worker, {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 1,
        timeoutMs: 5,
      })
    ).rejects.toThrow("operation timed out");

    expect(worker).toHaveBeenCalledTimes(2);
  });

  it("passes an abort signal to workers that can cancel underlying work", async () => {
    const worker = vi.fn(
      (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("cancelled by signal")), { once: true });
        })
    );

    await expect(
      withRetry(worker, {
        maxAttempts: 1,
        timeoutMs: 5,
      })
    ).rejects.toThrow(/cancelled by signal|operation timed out/);

    expect(worker.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal);
  });
});

describe("fetchWithRetry timeout budgets", () => {
  it("aborts fetch attempts with the configured timeout", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithRetry("https://worker.example.test/run", undefined, {
        maxAttempts: 1,
        timeoutMs: 5,
      })
    ).rejects.toThrow("aborted");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves retryable HTTP response behavior while enforcing a budget per attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://worker.example.test/run", undefined, {
      maxAttempts: 2,
      baseDelayMs: 1,
      maxDelayMs: 1,
      timeoutMs: 50,
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
