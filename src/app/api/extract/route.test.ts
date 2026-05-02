import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction/run-pipeline", () => ({
  runExtractionPipeline: vi.fn(),
}));

const requireApiWorkspaceEligibility = vi.fn();
vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

const rateLimitCheck = vi.fn();
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

const createClient = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

const SAMPLE_CONTRACT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("wires workspace eligibility guard", async () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    expect(requireApiWorkspaceEligibility).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 415 when Content-Type is set to a non-JSON value", async () => {
    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "a=b",
      })
    );
    expect(res.status).toBe(415);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/extract/route");
    const req = new Request("http://localhost:3000/api/extract", {
      method: "POST",
      body: "{",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON" });
  });

  it("returns 429 when rate limited (before auth)", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(
      new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ contractId: SAMPLE_CONTRACT_ID }),
      })
    );
    expect(res.status).toBe(429);
  });
});
