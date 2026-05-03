import { afterEach, describe, expect, it, vi } from "vitest";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";

const safeFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

describe("pingCronHealthcheck", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.CRON_HEALTHCHECK_URL;
    safeFetch.mockReset();
    vi.restoreAllMocks();
  });

  it("no-ops when CRON_HEALTHCHECK_URL is unset", () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    pingCronHealthcheck("/api/cron/v5/foo", { ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs JSON to a validated HTTPS URL when set", async () => {
    process.env.CRON_HEALTHCHECK_URL = "https://example.com/ping";
    safeFetch.mockResolvedValue(new Response(null, { status: 200 }));
    pingCronHealthcheck("/api/cron/v5/foo", { ok: true });
    await vi.waitFor(() => expect(safeFetch).toHaveBeenCalled());
    const [url, init] = safeFetch.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toBe("https://example.com/ping");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 5000,
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ route: "/api/cron/v5/foo", ok: true });
  });

  it("ignores invalid URLs", () => {
    process.env.CRON_HEALTHCHECK_URL = "http://127.0.0.1/nope";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    pingCronHealthcheck("/r", {});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(safeFetch).not.toHaveBeenCalled();
  });
});
