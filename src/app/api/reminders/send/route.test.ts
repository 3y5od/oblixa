import { describe, expect, it } from "vitest";

describe("GET /api/reminders/send", () => {
  it("returns 503 when CRON_SECRET is missing (cron auth contract)", async () => {
    delete process.env.CRON_SECRET;
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "srk";
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon";
    const { GET } = await import("@/app/api/reminders/send/route");
    const req = new Request("http://localhost:3000/api/reminders/send");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when request is unsigned", async () => {
    process.env.CRON_SECRET = "cronsecret";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "srk";
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon";
    const { GET } = await import("@/app/api/reminders/send/route");
    const req = new Request("http://localhost:3000/api/reminders/send");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });

  it("returns 503 dependency_blocked when canonical app url is unavailable", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.CRON_SECRET = "cronsecret";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const { GET } = await import("@/app/api/reminders/send/route");
    const req = new Request("http://localhost:3000/api/reminders/send", {
      headers: { "x-cron-secret": "cronsecret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "reminders_send_canonical_app_url_missing",
      phase: "dependency_preflight",
    });
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns 503 dependency_blocked when resend is unavailable", async () => {
    process.env.CRON_SECRET = "cronsecret";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    delete process.env.RESEND_API_KEY;
    const { GET } = await import("@/app/api/reminders/send/route");
    const req = new Request("http://localhost:3000/api/reminders/send", {
      headers: { Authorization: "Bearer cronsecret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "reminders_send_resend_missing",
      phase: "dependency_preflight",
    });
  });
});

