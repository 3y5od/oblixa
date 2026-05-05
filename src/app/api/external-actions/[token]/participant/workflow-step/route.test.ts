import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { appendExternalWorkflowStep } from "@/lib/v6/external-collaboration";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}));

const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

const rateLimitCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/v6/external-collaboration", () => ({
  appendExternalWorkflowStep: vi.fn(),
}));

const mockedFlags = vi.mocked(isFeatureEnabled);
const mockedAppend = vi.mocked(appendExternalWorkflowStep);

function mockOpenLink() {
  createAdminClient.mockResolvedValueOnce({
    from: vi.fn((table: string) => {
      if (table === "external_action_links") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "link-1",
                  organization_id: "o1",
                  status: "open",
                  expires_at: null,
                  passcode_hash: null,
                  scope_json: {},
                },
                error: null,
              })),
            })),
          })),
        };
      }
      return {};
    }),
  } as never);
}

describe("POST /api/external-actions/[token]/participant/workflow-step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 429 when rate limited", async () => {
    mockedFlags.mockImplementation(
      (key) => key === "v5ExternalCollaboration" || key === "v6AssuranceCore"
    );
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 1000 });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/t/participant/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "x", passcode: "p" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("1");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 when V5 external collaboration is disabled", async () => {
    mockedFlags.mockReturnValue(false);
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/t/participant/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "x", passcode: "p" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(403);
    expect(mockedAppend).not.toHaveBeenCalled();
  });

  it("returns 403 when V6 assurance core is disabled", async () => {
    mockedFlags.mockImplementation((key) => key === "v5ExternalCollaboration");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/t/participant/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "x", passcode: "p" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(403);
    expect(mockedAppend).not.toHaveBeenCalled();
  });

  it("returns 201 when passcode validates and append succeeds", async () => {
    mockedFlags.mockImplementation(
      (key) => key === "v5ExternalCollaboration" || key === "v6AssuranceCore"
    );
    mockOpenLink();
    mockedAppend.mockResolvedValueOnce({
      data: { id: "ea1", status: "open", scope_json: {} },
      error: null,
    } as Awaited<ReturnType<typeof appendExternalWorkflowStep>>);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/t/participant/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "participant_note", payload: { note: "ok" }, passcode: "any" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(201);
    expect(mockedAppend).toHaveBeenCalledWith(
      expect.anything(),
      "o1",
      "link-1",
      "participant_note",
      { note: "ok" },
      undefined
    );
  });

  it("blocks duplicate replay of participant workflow-step with x-idempotency-key", async () => {
    let idempotencySeen = false;
    mockedFlags.mockImplementation(
      (key) => key === "v5ExternalCollaboration" || key === "v6AssuranceCore"
    );
    rateLimitCheck.mockImplementation(async (key: string) => {
      if (key.startsWith("idem:external-workflow.participant-step:tok:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    mockOpenLink();
    mockedAppend.mockResolvedValueOnce({
      data: { id: "ea-dup", status: "open", scope_json: {} },
      error: null,
    } as Awaited<ReturnType<typeof appendExternalWorkflowStep>>);

    const { POST } = await import("./route");
    const buildRequest = () =>
      new Request("http://localhost/api/external-actions/t/participant/workflow-step", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "participant-workflow-replay-0001",
        },
        body: JSON.stringify({ stepType: "participant_note", payload: { note: "ok" }, passcode: "any" }),
      });

    const first = await POST(buildRequest(), { params: Promise.resolve({ token: "tok" }) });
    const second = await POST(buildRequest(), { params: Promise.resolve({ token: "tok" }) });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 6000,
    });
    expect(mockedAppend).toHaveBeenCalledTimes(1);
  });

  it("returns 207 when participant workflow step succeeds but event persistence fails", async () => {
    mockedFlags.mockImplementation(
      (key) => key === "v5ExternalCollaboration" || key === "v6AssuranceCore"
    );
    mockOpenLink();
    mockedAppend.mockResolvedValueOnce({
      data: { id: "ea1", status: "open", scope_json: {} },
      error: { message: "external_action_event_insert_failed" },
    } as Awaited<ReturnType<typeof appendExternalWorkflowStep>>);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/t/participant/workflow-step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepType: "participant_note", payload: { note: "ok" }, passcode: "any" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body).toMatchObject({ partial: true, errors_count: 1 });
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ diagnostic_id: "external_action_participant_workflow_event_insert_failed" }),
      ])
    );
  });
});
