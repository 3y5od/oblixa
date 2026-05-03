import { beforeEach, describe, expect, it } from "vitest";

describe("GET /api/reports/send-summaries", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalResendApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.RESEND_API_KEY = originalResendApiKey ?? "re_test_key";
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/reports/send-summaries/route");
    const req = new Request("http://localhost:3000/api/reports/send-summaries");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when auth header is missing", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/reports/send-summaries/route");
    const req = new Request("http://localhost:3000/api/reports/send-summaries");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });
});
