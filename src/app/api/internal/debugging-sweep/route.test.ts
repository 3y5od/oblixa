import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();
const getSweepCatalogStats = vi.fn();
const getStubsRegisteredCount = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { internalDebuggingSweep: { max: 30, windowMs: 60_000 } },
  rateLimitCheck,
  getClientIpFromRequest: () => "10.0.0.1",
}));

vi.mock("@/lib/debugging-sweep/catalog-index.server", () => ({
  getSweepCatalogStats,
}));

vi.mock("@/lib/debugging-sweep/stubs/register-stubs", () => ({
  getStubsRegisteredCount,
}));

vi.mock("@/lib/observability/logger", () => ({
  createSweepLogger: () => ({ error: vi.fn(), info: vi.fn() }),
}));

describe("GET /api/internal/debugging-sweep", () => {
  beforeEach(() => {
    vi.resetModules();
    rateLimitCheck.mockReset();
    getSweepCatalogStats.mockReset();
    getStubsRegisteredCount.mockReset();
    delete process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT;
    delete process.env.OBLIXA_INTERNAL_DIAG_SECRET;
    delete process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST;
  });

  it("returns 404 when endpoint disabled", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/internal/debugging-sweep"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for bad bearer", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/internal/debugging-sweep", {
        headers: { Authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns JSON with kind and sorted keys on success", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    getSweepCatalogStats.mockReturnValue({
      catalogVersion: "0.11.0",
      invariantBuildId: "abc",
      provenanceHash: "deadbeef",
      rowCount: 3,
      stubClassCount: 2,
    });
    getStubsRegisteredCount.mockReturnValue(2);
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/internal/debugging-sweep", {
        headers: { Authorization: "Bearer secret", "Accept-Language": "en-US,en;q=0.9" },
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.kind).toBe("OblixaDebuggingSweepReport");
    expect(Array.isArray(body.errors)).toBe(true);
    const keys = Object.keys(body);
    expect(keys).toEqual([...keys].sort());
  });
});
