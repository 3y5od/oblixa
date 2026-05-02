import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./retry";

describe("fetchWithRetry (db-concurrency / upstream retry contract)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once on 429 then returns successful response", async () => {
    const ok = new Response("{}", { status: 200 });
    const tooMany = new Response("{}", { status: 429 });
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tooMany)
      .mockResolvedValueOnce(ok);
    const res = await fetchWithRetry("https://api.example.test/v1", {}, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 4 });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
