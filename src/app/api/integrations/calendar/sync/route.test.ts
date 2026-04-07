import { describe, expect, it } from "vitest";

describe("GET /api/integrations/calendar/sync", () => {
  it("returns 401 when cron auth is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/integrations/calendar/sync/route");
    const req = new Request("http://localhost:3000/api/integrations/calendar/sync");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

