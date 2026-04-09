import { describe, expect, it } from "vitest";

describe("GET /api/webhooks/dispatch", () => {
  it("returns 500 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "CRON_SECRET missing" });
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "secret";
    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

describe("POST /api/webhooks/dispatch", () => {
  it("returns 401 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "replay_event", eventId: "evt_1" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

