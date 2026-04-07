import { describe, expect, it } from "vitest";

describe("GET /api/contracts/recompute-signals", () => {
  it("returns 401 when cron auth is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/contracts/recompute-signals/route");
    const req = new Request("http://localhost:3000/api/contracts/recompute-signals");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

