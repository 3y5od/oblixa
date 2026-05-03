import { beforeEach, describe, expect, it } from "vitest";

describe("GET /api/maintenance/prune-operational-data", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/maintenance/prune-operational-data/route");
    const req = new Request("http://localhost:3000/api/maintenance/prune-operational-data");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when request is not signed", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/maintenance/prune-operational-data/route");
    const req = new Request("http://localhost:3000/api/maintenance/prune-operational-data");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });
});
