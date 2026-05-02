import { describe, expect, it, vi } from "vitest";

const getV6OrgSettingsJson = vi.fn();
vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

describe("requireApiWorkspaceEligibility", () => {
  it("returns null for mapped core routes", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      apiPath: "/api/contracts/recompute-signals",
    });
    expect(res).toBeNull();
  });

  it("fails closed for unmapped api routes", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      apiPath: "/api/not-mapped-by-registry",
    });
    expect(res?.status).toBe(404);
  });

  it("returns 403 when workspace mode is below route family floor", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      apiPath: "/api/decisions",
    });
    expect(res?.status).toBe(404);
  });

  it("returns 404 when advanced module is hidden for non-admin", async () => {
    getV6OrgSettingsJson.mockResolvedValue({
      workspace_mode: "advanced",
      advanced_modules_hidden: ["decisions"],
    });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "editor",
      apiPath: "/api/decisions",
    });
    expect(res?.status).toBe(404);
  });

  it("returns null when advanced module is hidden but caller is admin", async () => {
    getV6OrgSettingsJson.mockResolvedValue({
      workspace_mode: "advanced",
      advanced_modules_hidden: ["decisions"],
    });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "admin",
      apiPath: "/api/decisions",
    });
    expect(res).toBeNull();
  });

  it("returns 404 when assurance module is hidden for non-admin", async () => {
    getV6OrgSettingsJson.mockResolvedValue({
      workspace_mode: "assurance",
      assurance_modules_hidden: ["autopilot"],
    });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "manager",
      apiPath: "/api/autopilot/runs",
    });
    expect(res?.status).toBe(404);
  });

  it("returns 404 when utility module API is hidden for non-admin", async () => {
    getV6OrgSettingsJson.mockResolvedValue({
      workspace_mode: "core",
      utility_modules_hidden: ["intake"],
    });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "editor",
      apiPath: "/api/import/contracts",
    });
    expect(res?.status).toBe(404);
  });

  it("supports explicit 403 override for guarded API families", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const { requireApiWorkspaceEligibility } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      apiPath: "/api/decisions",
      modeMismatchStatus: 403,
    });
    expect(res?.status).toBe(403);
  });

  it("returns V10 mutation envelopes for workspace gate denials when requested", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const { requireApiWorkspaceEligibilityV10 } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibilityV10({
      admin: {} as never,
      orgId: "org-1",
      apiPath: "/api/decisions",
    });
    const body = await res?.json();

    expect(res?.status).toBe(403);
    expect(res?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res?.headers.get("X-V10-Idempotent-Replay")).toBe("false");
    expect(body).toMatchObject({
      outcome: "mode_required",
      diagnostic_id: "v10_api_workspace_gate_insufficient_workspace_mode",
      next_destination_href: "/settings/product",
    });
  });

  it("returns V10 not_found envelopes for unmapped API routes", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const { requireApiWorkspaceEligibilityV10 } = await import(
      "@/lib/product-surface/api-workspace-guard"
    );
    const res = await requireApiWorkspaceEligibilityV10({
      admin: {} as never,
      orgId: "org-1",
      apiPath: "/api/not-mapped-by-registry",
    });
    const body = await res?.json();

    expect(res?.status).toBe(404);
    expect(body).toMatchObject({
      outcome: "not_found",
      diagnostic_id: "v10_api_workspace_mapping_missing",
    });
  });
});
