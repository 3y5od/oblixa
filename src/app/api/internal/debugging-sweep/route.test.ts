import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();
const getSweepCatalogStats = vi.fn();
const getStubsRegisteredCount = vi.fn();
const TEST_URL = "http://localhost/api/internal/debugging-sweep";

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
    delete process.env.OBLIXA_INTERNAL_DIAG_AUDIT_ORG_ID;
    getSweepCatalogStats.mockReturnValue({
      catalogVersion: "0.11.0",
      invariantBuildId: "abc",
      provenanceHash: "deadbeef",
      rowCount: 3,
      stubClassCount: 2,
    });
    getStubsRegisteredCount.mockReturnValue(2);
  });

  it("returns 404 when endpoint disabled", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request(TEST_URL));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      disabled: true,
      kind: "OblixaDebuggingSweepReport",
    });
    expect(rateLimitCheck).not.toHaveBeenCalled();
  });

  it("returns 404 when internal diagnostics secret is missing", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    const { GET } = await import("./route");
    const res = await GET(new Request(TEST_URL));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      disabled: true,
      kind: "OblixaDebuggingSweepReport",
    });
    expect(rateLimitCheck).not.toHaveBeenCalled();
  });

  it("returns 403 for wrong bearer secret", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    const { GET } = await import("./route");
    const res = await GET(
      new Request(TEST_URL, {
        headers: { Authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      errors: [{ code: "UNAUTHORIZED", detail: "invalid or missing bearer" }],
      kind: "OblixaDebuggingSweepReport",
    });
    expect(rateLimitCheck).not.toHaveBeenCalled();
  });

  it("returns 429 when internal diagnostics rate limit is exceeded", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 2500 });
    const { GET } = await import("./route");
    const res = await GET(
      new Request(TEST_URL, {
        headers: { Authorization: "Bearer secret" },
      })
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3");
    await expect(res.json()).resolves.toMatchObject({
      errors: [{ code: "RATE_LIMITED", detail: "retry later" }],
      kind: "OblixaDebuggingSweepReport",
    });
    expect(rateLimitCheck).toHaveBeenCalledWith("internal-debugging-sweep:10.0.0.1", {
      max: 30,
      windowMs: 60_000,
    });
  });

  it("returns 403 when allowlist parsing fails closed", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST = "10.0.0.0/99";
    rateLimitCheck.mockResolvedValue({ ok: true });
    const { GET } = await import("./route");
    const res = await GET(
      new Request(TEST_URL, {
        headers: { Authorization: "Bearer secret" },
      })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      errors: [{ code: "DIAG_IPLIST_INVALID", detail: "allowlist parse error" }],
      kind: "OblixaDebuggingSweepReport",
    });
  });

  it("returns 403 for allowlist denial", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST = "10.0.0.2";
    rateLimitCheck.mockResolvedValue({ ok: true });
    const { GET } = await import("./route");
    const res = await GET(
      new Request(TEST_URL, {
        headers: { Authorization: "Bearer secret" },
      })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      errors: [{ code: "FORBIDDEN_IP", detail: "not in allowlist" }],
      kind: "OblixaDebuggingSweepReport",
    });
  });

  it("returns JSON with kind and sorted keys for allowed secret and allowlisted IP", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST = "10.0.0.0/24";
    rateLimitCheck.mockResolvedValue({ ok: true });
    const { GET } = await import("./route");
    const res = await GET(
      new Request(TEST_URL, {
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

  it("redacts sensitive diagnostic payload values", async () => {
    process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT = "1";
    process.env.OBLIXA_INTERNAL_DIAG_SECRET = "secret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    getSweepCatalogStats.mockReturnValue({
      catalogVersion: "0.11.0 Bearer abcdefghijk12345",
      invariantBuildId: "builder@example.com",
      provenanceHash: "https://storage.test/a?token=private123456",
      rowCount: 3,
      stubClassCount: 2,
    });
    const { GET } = await import("./route");
    const res = await GET(
      new Request(TEST_URL, {
        headers: {
          Authorization: "Bearer secret",
          "Accept-Language": "Bearer abcdefghijk12345",
        },
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("[redacted]");
    expect(text).not.toContain("abcdefghijk");
    expect(text).not.toContain("builder@example.com");
    expect(text).not.toContain("private123456");
    expect(JSON.parse(text)).toMatchObject({ negotiatedLocale: "en" });
  });
});
