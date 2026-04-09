import { beforeEach, describe, expect, it } from "vitest";

describe("POST /api/tasks/from-email", () => {
  beforeEach(() => {
    delete process.env.INBOUND_AUTOMATION_TOKEN;
    delete process.env.INBOUND_EMAIL_AUTOMATION_TOKEN;
  });

  it("returns 401 when inbound token is not configured", async () => {
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid body when authorized", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: "abc", contractId: "def", subject: "" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: "organizationId, contractId, and subject are required.",
    });
  });

  it("returns 400 for invalid dueDate and externalMessageId", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-email/route");
    const req = new Request("http://localhost:3000/api/tasks/from-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        subject: "hello",
        dueDate: "2026-13-01",
        externalMessageId: "bad id with spaces",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "dueDate must be ISO date (YYYY-MM-DD)" });
  });
});

