import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => undefined),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/external-actions/create-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: { from: vi.fn() },
    } as never);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 403 when external collaboration is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionType: "submit_evidence" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid actionType", async () => {
    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionType: "not_valid_external_action" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when workflowDeadlineIso is in the past", async () => {
    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionType: "submit_evidence",
          workflowDeadlineIso: "2000-01-01T00:00:00.000Z",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/future ISO/i);
  });

  it("returns 400 when workflowDeadlineIso is after link expiry", async () => {
    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const far = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionType: "submit_evidence",
          expiresInHours: 1,
          workflowDeadlineIso: far,
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/before the link expires/i);
  });

  it("returns 201 externalAction payload shape and stores workflow_deadline_iso on scope_json when deadline is valid", async () => {
    const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const captured: { scope_json?: Record<string, unknown> } = {};
    const from = vi.fn((table: string) => {
      if (table === "external_action_links") {
        return {
          insert: (row: { scope_json?: Record<string, unknown> }) => {
            Object.assign(captured, row);
            return {
              select: () => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "00000000-0000-4000-8000-000000000001",
                    token: "toktok",
                    action_type: "submit_evidence",
                    expires_at: expiresAt,
                    status: "open",
                  },
                  error: null,
                })),
              }),
            };
          },
        };
      }
      if (table === "external_action_events") {
        return {
          insert: vi.fn(async () => ({})),
        };
      }
      return {};
    });
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      admin: { from },
    } as never);

    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionType: "submit_evidence",
          workflowDeadlineIso: futureDeadline,
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      externalAction?: {
        id?: string;
        token?: string;
        action_type?: string;
        expires_at?: string;
        status?: string;
      };
    };
    expect(body.externalAction).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      token: "toktok",
      action_type: "submit_evidence",
      expires_at: expiresAt,
      status: "open",
    });
    expect(captured.scope_json?.workflow_deadline_iso).toBe(futureDeadline);
    expect(captured.scope_json?.workflow_ack_required).toBe(true);
  });

  it("blocks duplicate replay of create-link with x-idempotency-key", async () => {
    const linkInsert = vi.fn(() => ({
      select: () => ({
        single: vi.fn(async () => ({
          data: {
            id: "00000000-0000-4000-8000-000000000002",
            token: "tok-replay",
            action_type: "submit_evidence",
            expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            status: "open",
          },
          error: null,
        })),
      }),
    }));
    const from = vi.fn((table: string) => {
      if (table === "external_action_links") {
        return { insert: linkInsert };
      }
      if (table === "external_action_events") {
        return { insert: vi.fn(async () => ({})) };
      }
      return {};
    });
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      role: "admin",
      admin: { from },
    } as never);

    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const buildRequest = () =>
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "create-link-replay-0001",
        },
        body: JSON.stringify({ actionType: "submit_evidence" }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: expect.any(Number),
    });
    expect(linkInsert).toHaveBeenCalledTimes(1);
  });

  it("returns 207 when link creation succeeds but the audit event insert fails", async () => {
    const from = vi.fn((table: string) => {
      if (table === "external_action_links") {
        return {
          insert: () => ({
            select: () => ({
              single: vi.fn(async () => ({
                data: {
                  id: "00000000-0000-4000-8000-000000000003",
                  token: "tok-partial",
                  action_type: "submit_evidence",
                  expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
                  status: "open",
                },
                error: null,
              })),
            }),
          }),
        };
      }
      if (table === "external_action_events") {
        return { insert: vi.fn(async () => ({ error: { message: "boom" } })) };
      }
      return {};
    });
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      admin: { from },
    } as never);

    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionType: "submit_evidence" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body).toMatchObject({ partial: true, errors_count: 1 });
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ diagnostic_id: "external_action_link_event_insert_failed" })])
    );
  });
});
