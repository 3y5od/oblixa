import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { signExternalSubmitTicket } from "@/lib/v5/api";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}));

const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

const rateLimitCheck = vi.hoisted(() => vi.fn());
const appendExternalWorkflowStep = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/v5/relationship-timeline", () => ({
  appendAccountTimelineEvent: vi.fn(),
  appendCounterpartyTimelineEvent: vi.fn(),
}));

vi.mock("@/lib/v6/external-collaboration", () => ({
  appendExternalWorkflowStep,
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => ({})),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

const mockedFlags = vi.mocked(isFeatureEnabled);

function mockLinkSelect(data: Record<string, unknown> | null) {
  createAdminClient.mockResolvedValueOnce({
    from: vi.fn((table: string) => {
      if (table === "external_action_links") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data, error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
      };
    }),
  } as never);
}

describe("POST /api/external-actions/[token]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
    appendExternalWorkflowStep.mockResolvedValue({ data: null, error: null });
  });

  it("returns 429 when rate limited", async () => {
    mockedFlags.mockReturnValue(true);
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2000 });
    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "x" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("2");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 403 when external collaboration is disabled", async () => {
    mockedFlags.mockReturnValue(false);
    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/t/submit", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ token: "abc" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when one-time link already submitted", async () => {
    mockedFlags.mockReturnValue(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    mockLinkSelect({
      id: "l1",
      organization_id: "o1",
      status: "submitted",
      expires_at: future,
      one_time: true,
      action_type: "submit_evidence",
      scope_json: {},
      passcode_hash: null,
      decision_workspace_id: null,
      requires_reauth: false,
    });

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "x" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(409);
  });

  it("returns 410 when external action link is expired", async () => {
    mockedFlags.mockReturnValue(true);
    const past = new Date(Date.now() - 60_000).toISOString();
    mockLinkSelect({
      id: "l-expired",
      organization_id: "o1",
      status: "open",
      expires_at: past,
      one_time: true,
      action_type: "submit_evidence",
      scope_json: {},
      passcode_hash: null,
      decision_workspace_id: null,
      requires_reauth: false,
    });

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "x" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body).toEqual({ error: "External action link expired" });
  });

  it("returns 409 when a concurrent submit already consumed the link", async () => {
    mockedFlags.mockReturnValue(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "external_action_links") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "link-uuid-1",
                    organization_id: "o1",
                    status: "open",
                    expires_at: future,
                    one_time: true,
                    action_type: "submit_evidence",
                    scope_json: {},
                    passcode_hash: null,
                    decision_workspace_id: null,
                    requires_reauth: false,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "external_action_events") {
          return { insert: vi.fn(async () => ({ error: null })) };
        }
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })),
        };
      }),
    };
    createAdminClient.mockResolvedValueOnce(admin as never);

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(409);
  });

  it("returns 403 when requires_reauth and submit ticket missing", async () => {
    mockedFlags.mockReturnValue(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    mockLinkSelect({
      id: "link-uuid-1",
      organization_id: "o1",
      status: "open",
      expires_at: future,
      one_time: true,
      action_type: "submit_evidence",
      scope_json: {},
      passcode_hash: null,
      decision_workspace_id: null,
      requires_reauth: true,
    });

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("submit_ticket_required");
  });

  it("accepts submit when requires_reauth and valid ticket", async () => {
    mockedFlags.mockReturnValue(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    const ticket = signExternalSubmitTicket({ linkId: "link-uuid-1", urlToken: "tok" });

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "external_action_links") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "link-uuid-1",
                    organization_id: "o1",
                    status: "open",
                    expires_at: future,
                    one_time: true,
                    action_type: "submit_evidence",
                    scope_json: {},
                    passcode_hash: null,
                    decision_workspace_id: null,
                    requires_reauth: true,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: "link-uuid-1", status: "submitted", submitted_at: future },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "external_action_events") {
          return { insert: vi.fn(async () => ({ error: null })) };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })) };
      }),
    };
    createAdminClient.mockResolvedValueOnce(admin as never);

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello", submitTicket: ticket }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 207 partial when submission follow-up event persistence fails", async () => {
    mockedFlags.mockReturnValue(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    const ticket = signExternalSubmitTicket({ linkId: "link-uuid-1", urlToken: "tok" });

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "external_action_links") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "link-uuid-1",
                    organization_id: "o1",
                    status: "open",
                    expires_at: future,
                    one_time: true,
                    action_type: "submit_evidence",
                    scope_json: {},
                    passcode_hash: null,
                    decision_workspace_id: null,
                    requires_reauth: true,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: "link-uuid-1", status: "submitted", submitted_at: future },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "external_action_events") {
          return { insert: vi.fn(async () => ({ error: { message: "boom" } })) };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) })) };
      }),
    };
    createAdminClient.mockResolvedValueOnce(admin as never);

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello", submitTicket: ticket }),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body).toMatchObject({ partial: true, errors_count: 1 });
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ diagnostic_id: "external_action_submit_event_insert_failed" })])
    );
  });

  it("returns 400 when payload invalid for action type", async () => {
    mockedFlags.mockReturnValue(true);
    const future = new Date(Date.now() + 86400000).toISOString();
    mockLinkSelect({
      id: "l1",
      organization_id: "o1",
      status: "open",
      expires_at: future,
      one_time: true,
      action_type: "acknowledge_receipt",
      scope_json: {},
      passcode_hash: null,
      decision_workspace_id: null,
      requires_reauth: false,
    });

    const { POST } = await import("@/app/api/external-actions/[token]/submit/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/tok/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ token: "tok" }) }
    );
    expect(res.status).toBe(400);
  });
});
