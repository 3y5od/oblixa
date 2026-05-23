import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.hoisted(() => vi.fn());
const rateLimitCheck = vi.hoisted(() => vi.fn());
const getClientIpFromHeaders = vi.hoisted(() => vi.fn(async () => "203.0.113.10"));
const emitProductTelemetryEvent = vi.hoisted(() => vi.fn(async () => null));
const recordApiMutationAuditEvent = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
    getClientIpFromHeaders,
  };
});

vi.mock("@/lib/product-telemetry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/product-telemetry")>("@/lib/product-telemetry");
  return {
    ...actual,
    emitProductTelemetryEvent,
  };
});

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

describe("product telemetry page-load API guard order", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "org_1",
      user: { id: "user_1" },
    });
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("runs rate limiting before request body parsing", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/product-telemetry/page-load/route.ts"), "utf8");
    const rateLimitIndex = source.indexOf("rateLimitCheck(");
    const bodyParseIndex = source.indexOf("readJsonBodyLimited(request)");

    expect(rateLimitIndex).toBeGreaterThanOrEqual(0);
    expect(bodyParseIndex).toBeGreaterThanOrEqual(0);
    expect(rateLimitIndex).toBeLessThan(bodyParseIndex);
  });

  it("blocks duplicate page-load telemetry replay with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string) => {
      if (key.startsWith("idem:api.product-telemetry.page-load:org_1:user_1:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 7000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });

    const { POST } = await import("@/app/api/product-telemetry/page-load/route");
    const buildRequest = () =>
      new Request("https://oblixa.test/api/product-telemetry/page-load", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "page-load-replay-0001",
        },
        body: JSON.stringify({ path: "/dashboard", durationMs: 123 }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(204);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 7000,
    });
    expect(emitProductTelemetryEvent).toHaveBeenCalledTimes(1);
  });
});
