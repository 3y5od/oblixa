import { describe, expect, it } from "vitest";

describe("GET /api/tasks/run-rules", () => {
  it("returns 401 when cron auth is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/tasks/run-rules/route");
    const req = new Request("http://localhost:3000/api/tasks/run-rules");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

