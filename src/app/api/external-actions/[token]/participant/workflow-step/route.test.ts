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
});
