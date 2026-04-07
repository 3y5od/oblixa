import { beforeEach, describe, expect, it, vi } from "vitest";

const runExtractionPipeline = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/extraction/run-pipeline", () => ({
  runExtractionPipeline,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { extractWorker: { max: 120, windowMs: 60_000 } },
  getClientIpFromRequest: () => "127.0.0.1",
  rateLimitCheck,
}));

describe("POST /api/extract/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXTRACTION_WORKER_SECRET = "topsecret";
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 401 when bearer token is missing", async () => {
    const { POST } = await import("@/app/api/extract/run/route");
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid ids", async () => {
    const { POST } = await import("@/app/api/extract/run/route");
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer topsecret",
      },
      body: JSON.stringify({
        contractId: "abc",
        userId: "def",
        organizationId: "ghi",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid ids" });
    expect(runExtractionPipeline).not.toHaveBeenCalled();
  });

  it("runs pipeline and returns ok for valid request", async () => {
    runExtractionPipeline.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/extract/run/route");
    const payload = {
      contractId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
    };
    const req = new Request("http://localhost:3000/api/extract/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer topsecret",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(runExtractionPipeline).toHaveBeenCalledWith(payload);
  });
});
