import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { runApiRoute } from "./route-runner";

const rateLimitCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck,
  };
});

describe("runApiRoute", () => {
  it("returns typed dependency-blocked responses", async () => {
    const response = await runApiRoute(new Request("https://oblixa.test/api/example"), {
      route: "/api/example",
      dependencyPreflight: () => ({
        error: "Canonical app URL is not configured",
        code: "dependency_blocked",
        diagnostic_id: "route_canonical_app_url_missing",
        details: { dependency: "canonical_app_url", required_env: ["NEXT_PUBLIC_APP_URL"] },
      }),
      handler: async () => ({ ok: true }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "route_canonical_app_url_missing",
      phase: "dependency_preflight",
    });
  });

  it("returns 207 for partial results", async () => {
    const response = await runApiRoute(new Request("https://oblixa.test/api/example"), {
      route: "/api/example",
      handler: async () => ({ partial: true, errorsCount: 1, body: { processed: 3, failed: 1 } }),
    });

    expect(response.status).toBe(207);
    await expect(response.json()).resolves.toMatchObject({ partial: true, errors_count: 1, processed: 3, failed: 1 });
  });

  it("returns stable unhandled errors", async () => {
    const response = await runApiRoute(new Request("https://oblixa.test/api/example"), {
      route: "/api/example",
      handler: async () => {
        throw new TypeError("boom https://secret.example token");
      },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: "unhandled_internal",
      diagnostic_id: "route_unhandled_internal",
      error_class: "TypeError",
    });
  });

  it("returns route rate-limit failures when configured", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 1250 });
    const response = await runApiRoute(new Request("https://oblixa.test/api/example"), {
      route: "/api/example",
      rateLimitKey: "route-test",
      rateLimit: RATE_LIMITS.v6CronDefault,
      handler: async () => ({ ok: true }),
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: "rate_limited", diagnostic_id: "route_rate_limited" });
  });

  it("preserves authorize denials", async () => {
    const response = await runApiRoute(new Request("https://oblixa.test/api/example"), {
      route: "/api/example",
      authorize: () => NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
      handler: async () => ({ ok: true }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
