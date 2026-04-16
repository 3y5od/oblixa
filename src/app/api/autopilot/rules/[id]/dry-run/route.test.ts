import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: () => null,
}));

const requireV6Context = vi.fn();
const enforceIdempotency = vi.fn(async () => null as Response | null);
vi.mock("@/lib/v6/api-auth", () => ({
  requireV6Context: (...args: unknown[]) => requireV6Context(...args),
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

const getV6OrgSettingsJson = vi.fn();
vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

vi.mock("@/lib/v6/autopilot", () => ({
  dryRunAutopilotRule: vi.fn(),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(),
}));

describe("POST /api/autopilot/rules/[id]/dry-run (§17.2)", () => {
  beforeEach(() => {
    requireV6Context.mockReset();
    getV6OrgSettingsJson.mockReset();
    enforceIdempotency.mockReset();
    enforceIdempotency.mockResolvedValue(null);
  });

  it("returns 404 when workspace is not in Assurance mode", async () => {
    requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "o1", userId: "u1" },
      errorResponse: null,
    });
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });

    const { POST } = await import("@/app/api/autopilot/rules/[id]/dry-run/route");
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "rule-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns idempotency duplicate response before dry run", async () => {
    requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "o1", userId: "u1", role: "admin" },
      errorResponse: null,
    });
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "assurance" });
    enforceIdempotency.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Duplicate request blocked by idempotency key" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );

    const { POST } = await import("@/app/api/autopilot/rules/[id]/dry-run/route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "x-idempotency-key": "dup-key-5678" },
      }),
      { params: Promise.resolve({ id: "rule-1" }) }
    );
    expect(res.status).toBe(409);
  });
});
