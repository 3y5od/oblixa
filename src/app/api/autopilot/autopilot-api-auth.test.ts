import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const hoisted = vi.hoisted(() => ({
  requireAssuranceWorkspaceForAutopilotApi: vi.fn(),
}));

vi.mock("@/lib/v6/require-assurance-workspace-for-autopilot-api", () => ({
  requireAssuranceWorkspaceForAutopilotApi: (...args: unknown[]) =>
    hoisted.requireAssuranceWorkspaceForAutopilotApi(...args),
}));

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: () => null,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

const requireV6Context = vi.fn();

vi.mock("@/lib/v6/api-auth", () => ({
  requireV6Context: (...args: unknown[]) => requireV6Context(...args),
}));

describe("autopilot API auth (§17.2 / §19)", () => {
  beforeEach(() => {
    requireV6Context.mockReset();
    hoisted.requireAssuranceWorkspaceForAutopilotApi.mockReset();
    hoisted.requireAssuranceWorkspaceForAutopilotApi.mockResolvedValue(null);
  });

  it("GET /api/autopilot/rules returns 401 when session is missing", async () => {
    requireV6Context.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    });

    const { GET } = await import("@/app/api/autopilot/rules/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(hoisted.requireAssuranceWorkspaceForAutopilotApi).not.toHaveBeenCalled();
  });

  it("GET /api/autopilot/rules returns 403 when workspace is not Assurance mode", async () => {
    requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "o1", userId: "u1" },
      errorResponse: null,
    });
    hoisted.requireAssuranceWorkspaceForAutopilotApi.mockResolvedValue(
      NextResponse.json(
        { error: "Autopilot API requires Assurance workspace mode (docs/refinement.md §17.2)." },
        { status: 403 }
      )
    );

    const { GET } = await import("@/app/api/autopilot/rules/route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(hoisted.requireAssuranceWorkspaceForAutopilotApi).toHaveBeenCalledWith({}, "o1");
  });
});
