import { beforeEach, describe, expect, it } from "vitest";

describe("GET /api/reports/capture-metrics", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 401 when auth header is missing", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/reports/capture-metrics/route");
    const req = new Request("http://localhost:3000/api/reports/capture-metrics");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when cron auth env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/reports/capture-metrics/route");
    const req = new Request("http://localhost:3000/api/reports/capture-metrics");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });
});
