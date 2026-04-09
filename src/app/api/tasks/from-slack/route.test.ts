import { beforeEach, describe, expect, it } from "vitest";

describe("POST /api/tasks/from-slack", () => {
  beforeEach(() => {
    delete process.env.INBOUND_AUTOMATION_TOKEN;
  });

  it("returns 401 when inbound token is not configured", async () => {
    const { POST } = await import("@/app/api/tasks/from-slack/route");
    const req = new Request("http://localhost:3000/api/tasks/from-slack", {
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
    const { POST } = await import("@/app/api/tasks/from-slack/route");
    const req = new Request("http://localhost:3000/api/tasks/from-slack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({ organizationId: "bad", contractId: "bad", title: "x" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: "organizationId and contractId must be valid UUIDs",
    });
  });

  it("returns 400 for invalid assigneeId", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-slack/route");
    const req = new Request("http://localhost:3000/api/tasks/from-slack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        title: "task",
        assigneeId: "not-a-uuid",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "assigneeId must be a valid UUID" });
  });

  it("returns 400 for invalid dueDate and teamKey", async () => {
    process.env.INBOUND_AUTOMATION_TOKEN = "token";
    const { POST } = await import("@/app/api/tasks/from-slack/route");
    const req = new Request("http://localhost:3000/api/tasks/from-slack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token",
      },
      body: JSON.stringify({
        organizationId: "00000000-0000-0000-0000-000000000001",
        contractId: "00000000-0000-0000-0000-000000000002",
        title: "task",
        dueDate: "2026-99-99",
        teamKey: "bad team key",
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "dueDate must be ISO date (YYYY-MM-DD)" });
  });
});

