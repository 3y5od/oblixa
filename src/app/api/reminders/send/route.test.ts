import { describe, expect, it } from "vitest";

describe("GET /api/reminders/send", () => {
  it("returns 500 when CRON_SECRET is missing", async () => {
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
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Service unavailable" });
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
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

