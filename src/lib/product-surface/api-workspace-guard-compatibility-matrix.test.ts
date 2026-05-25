import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const getOrgSettingsJson = vi.fn();

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

describe("requireApiWorkspaceEligibility (V7 §20.1 Core matrix)", () => {
  beforeEach(() => {
    getOrgSettingsJson.mockReset();
  });

  it("returns 404 for campaigns API path when workspace is Core (non-admin has no reveal bypass)", async () => {
    getOrgSettingsJson.mockResolvedValue({
      workspace_mode: "core",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      utility_modules_hidden: [],
      search_scope: "match_mode",
    });
    const gate = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "viewer",
      apiPath: "/api/campaigns",
    });
    expect(gate).not.toBeNull();
    expect(gate?.status).toBe(404);
  });

  it("returns null for campaigns API path when workspace is Advanced", async () => {
    getOrgSettingsJson.mockResolvedValue({
      workspace_mode: "advanced",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      utility_modules_hidden: [],
      search_scope: "match_mode",
    });
    const gate = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "admin",
      apiPath: "/api/campaigns",
    });
    expect(gate).toBeNull();
  });

  it("returns 404 for intelligence API path when workspace is Core (viewer)", async () => {
    getOrgSettingsJson.mockResolvedValue({
      workspace_mode: "core",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      utility_modules_hidden: [],
      search_scope: "match_mode",
    });
    const gate = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "viewer",
      apiPath: "/api/intelligence/contracts/summary",
    });
    expect(gate).not.toBeNull();
    expect(gate?.status).toBe(404);
  });

  it("returns 404 for assurance findings API path when workspace is Core (viewer)", async () => {
    getOrgSettingsJson.mockResolvedValue({
      workspace_mode: "core",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      utility_modules_hidden: [],
      search_scope: "match_mode",
    });
    const gate = await requireApiWorkspaceEligibility({
      admin: {} as never,
      orgId: "org-1",
      role: "viewer",
      apiPath: "/api/assurance/findings",
    });
    expect(gate).not.toBeNull();
    expect(gate?.status).toBe(404);
  });
});
