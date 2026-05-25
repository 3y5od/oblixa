import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import {
  appendExternalWorkflowStep,
  setExternalWorkflowAckDeadline,
} from "@/lib/assurance/external-collaboration";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}));

const getApiAuthContext = vi.hoisted(() => vi.fn());
const canManageCapability = vi.hoisted(() => vi.fn());

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const rateLimitCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/assurance/external-collaboration", () => ({
  appendExternalWorkflowStep: vi.fn(),
  setExternalWorkflowAckDeadline: vi.fn(),
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(async () => undefined),
}));

const mockedFlags = vi.mocked(isFeatureEnabled);
const mockedV5Guard = vi.mocked(requireV5ApiFeature);
const mockedAppendExternalWorkflowStep = vi.mocked(appendExternalWorkflowStep);
const mockedSetExternalWorkflowAckDeadline = vi.mocked(setExternalWorkflowAckDeadline);

describe("POST /api/external-actions/[token]/workflow-step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFlags.mockReturnValue(true);
    mockedV5Guard.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    canManageCapability.mockResolvedValue(true);
    mockedSetExternalWorkflowAckDeadline.mockResolvedValue({
      data: { id: "link-1", scope_json: {} },
      error: null,
    } as unknown as Awaited<ReturnType<typeof setExternalWorkflowAckDeadline>>);
  });

  it("returns 429 when rate limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 6000 });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "handoff" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("6");
    expect(getApiAuthContext).not.toHaveBeenCalled();
  });

  it("returns externalAction payload shape and workflow fields when append succeeds", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "link-1", organization_id: "o1" },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      role: "admin",
      admin,
    });
    mockedAppendExternalWorkflowStep.mockResolvedValueOnce({
      data: {
        id: "ea-1",
        status: "open",
        workflow_chain: [{ type: "handoff", payload: { summary: "ready" } }],
        workflow_ack_required: true,
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof appendExternalWorkflowStep>>);

    const ackDeadlineIso = "2030-01-01T00:00:00.000Z";
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stepType: "handoff",
          payload: { summary: "ready" },
          ackDeadlineIso,
        }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      externalAction?: {
        id?: string;
        status?: string;
        workflow_chain?: Array<{ type?: string; payload?: { summary?: string } }>;
        workflow_ack_required?: boolean;
      };
    };
    expect(body.externalAction).toMatchObject({
      id: "ea-1",
      status: "open",
      workflow_chain: [{ type: "handoff", payload: { summary: "ready" } }],
      workflow_ack_required: true,
    });
    expect(mockedAppendExternalWorkflowStep).toHaveBeenCalledWith(
      admin,
      "o1",
      "link-1",
      "handoff",
      { summary: "ready" },
      "u1"
    );
    expect(mockedSetExternalWorkflowAckDeadline).toHaveBeenCalledWith(
      admin,
      "o1",
      "link-1",
      ackDeadlineIso
    );
  });

  it("rejects revoked public-token links before appending workflow steps", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "link-revoked",
                  organization_id: "o1",
                  status: "open",
                  revoked_at: "2026-01-01T00:00:00.000Z",
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      role: "admin",
      admin,
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "handoff" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toMatchObject({
      code: "external_action_revoked",
      diagnostic_id: "external_action_workflow_revoked",
    });
    expect(mockedAppendExternalWorkflowStep).not.toHaveBeenCalled();
  });

  it("blocks duplicate replay of internal workflow-step with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string) => {
      if (key.startsWith("idem:external-workflow.internal-step:o1:u1:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "link-1", organization_id: "o1" },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      role: "admin",
      admin,
    });
    mockedAppendExternalWorkflowStep.mockResolvedValueOnce({
      data: { id: "ea-dup", status: "open" },
      error: null,
    } as unknown as Awaited<ReturnType<typeof appendExternalWorkflowStep>>);

    const { POST } = await import("./route");
    const buildRequest = () =>
      new Request("http://localhost/api/external-actions/tok/workflow-step", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "workflow-step-replay-0001",
        },
        body: JSON.stringify({ stepType: "handoff", payload: { summary: "ready" } }),
      });

    const first = await POST(buildRequest(), { params: Promise.resolve({ token: "tok" }) });
    const second = await POST(buildRequest(), { params: Promise.resolve({ token: "tok" }) });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 6000,
    });
    expect(mockedAppendExternalWorkflowStep).toHaveBeenCalledTimes(1);
  });

  it("returns 207 when workflow step succeeds but ack-deadline persistence fails", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "link-1", organization_id: "o1" },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      role: "admin",
      admin,
    });
    mockedAppendExternalWorkflowStep.mockResolvedValueOnce({
      data: { id: "ea-1", status: "open" },
      error: null,
    } as unknown as Awaited<ReturnType<typeof appendExternalWorkflowStep>>);
    mockedSetExternalWorkflowAckDeadline.mockResolvedValueOnce({
      data: null,
      error: { message: "write failed" },
    } as unknown as Awaited<ReturnType<typeof setExternalWorkflowAckDeadline>>);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "handoff", ackDeadlineIso: "2030-01-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body).toMatchObject({ partial: true, errors_count: 1 });
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ diagnostic_id: "external_action_workflow_ack_deadline_persist_failed" }),
      ])
    );
  });
});
