import { describe, expect, it } from "vitest";

describe("GET /api/tasks/run-rules", () => {
  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/tasks/run-rules/route");
    const req = new Request("http://localhost:3000/api/tasks/run-rules");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });
});

