import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/assurance/require-assurance-workspace-for-autopilot-api";

const getOrgSettingsJson = vi.fn();

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

describe("requireAssuranceWorkspaceForAutopilotApi", () => {
  beforeEach(() => {
    getOrgSettingsJson.mockReset();
  });

  it("returns null when workspace_mode is assurance", async () => {
    getOrgSettingsJson.mockResolvedValue({ workspace_mode: "assurance" });
    const out = await requireAssuranceWorkspaceForAutopilotApi({} as never, "o1");
    expect(out).toBeNull();
  });

  it("returns 403 when workspace is core", async () => {
    getOrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const out = await requireAssuranceWorkspaceForAutopilotApi({} as never, "o1", "api");
    expect(out?.status).toBe(403);
  });

  it("uses dry_run message when kind is dry_run", async () => {
    getOrgSettingsJson.mockResolvedValue({ workspace_mode: "advanced" });
    const out = await requireAssuranceWorkspaceForAutopilotApi({} as never, "o1", "dry_run");
    expect(out?.status).toBe(403);
    const body = await out!.json();
    expect(String(body.error)).toContain("dry-run");
  });
});
