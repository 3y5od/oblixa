import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/feature-flags";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}));

const getApiAuthContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(),
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

vi.mock("@/lib/v6/external-collaboration", () => ({
  appendExternalWorkflowStep: vi.fn(),
  setExternalWorkflowAckDeadline: vi.fn(),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(),
}));

const mockedFlags = vi.mocked(isFeatureEnabled);

describe("POST /api/external-actions/[token]/workflow-step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFlags.mockReturnValue(true);
    rateLimitCheck.mockResolvedValue({ ok: true });
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
});
