import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeFetchError, safeFetch } from "./safe-fetch";

const origFetch = globalThis.fetch;

describe("safeFetch", () => {
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.useRealTimers();
  });

  it("throws SafeFetchError when response body exceeds maxBytes", async () => {
    const chunk = new Uint8Array(1024);
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 20; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    globalThis.fetch = vi.fn(async () => new Response(stream, { status: 200 })) as typeof fetch;

    await expect(safeFetch("https://example.com/x", { maxBytes: 5000 })).rejects.toThrow(SafeFetchError);
  });

  it("returns small responses", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    ) as typeof fetch;

    const res = await safeFetch("https://example.com/y", { maxBytes: 100_000 });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean };
    expect(j.ok).toBe(true);
  });

  it("follows redirects with manual redirect handling", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: "/next" } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      ) as typeof fetch;

    const res = await safeFetch("https://example.com/start");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0])).toBe(
      "https://example.com/next"
    );
  });

  it("throws when Location is missing on a redirect", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 302, headers: {} })
    ) as typeof fetch;
    await expect(safeFetch("https://example.com/a")).rejects.toMatchObject({
      name: "SafeFetchError",
      message: "redirect limit exceeded or missing Location",
    });
  });

  it("throws when maxRedirects is exhausted", async () => {
    const redir = () =>
      new Response(null, { status: 302, headers: { Location: "/loop" } });
    globalThis.fetch = vi.fn(async () => redir()) as typeof fetch;
    await expect(
      safeFetch("https://example.com/a", { maxRedirects: 2 })
    ).rejects.toThrow("redirect limit exceeded or missing Location");
  });

  it("wraps fetch rejections as SafeFetchError", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;
    await expect(safeFetch("https://example.com/x")).rejects.toMatchObject({
      name: "SafeFetchError",
      message: "fetch failed: network down",
    });
  });

  it("aborts when timeoutMs elapses", async () => {
    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      await new Promise<void>((resolve, reject) => {
        if (!signal) {
          resolve();
          return;
        }
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
      return new Response("ok");
    }) as typeof fetch;

    const err = await safeFetch("https://example.com/slow", { timeoutMs: 30 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SafeFetchError);
    expect((err as Error).message).toMatch(/^fetch failed:/);
  });

  it("wraps body read failures as SafeFetchError", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(new Uint8Array([1]));
        else throw new Error("read boom");
      },
    });
    globalThis.fetch = vi.fn(async () => new Response(stream, { status: 200 })) as typeof fetch;
    await expect(safeFetch("https://example.com/z", { maxBytes: 1_000_000 })).rejects.toMatchObject({
      name: "SafeFetchError",
      message: "read failed: read boom",
    });
  });
});
