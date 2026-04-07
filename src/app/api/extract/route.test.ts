import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction/run-pipeline", () => ({
  runExtractionPipeline: vi.fn(),
}));

describe("POST /api/extract", () => {
  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/extract/route");
    const req = new Request("http://localhost:3000/api/extract", {
      method: "POST",
      body: "{",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Request body must be valid JSON" });
  });
});

