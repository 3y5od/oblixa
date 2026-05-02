import { describe, it, expect, vi, afterEach } from "vitest";

describe("fetch JSON integration (mocked)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles application/json responses", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const res = await fetch("https://example.test/api");
    expect(res.ok).toBe(true);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
