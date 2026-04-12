import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/v6/require-assurance-workspace-for-autopilot-api";

const getV6OrgSettingsJson = vi.fn();

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

describe("requireAssuranceWorkspaceForAutopilotApi", () => {
  beforeEach(() => {
    getV6OrgSettingsJson.mockReset();
  });

  it("returns null when workspace_mode is assurance", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "assurance" });
    const out = await requireAssuranceWorkspaceForAutopilotApi({} as never, "o1");
    expect(out).toBeNull();
  });

  it("returns 403 when workspace is core", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    const out = await requireAssuranceWorkspaceForAutopilotApi({} as never, "o1", "api");
    expect(out?.status).toBe(403);
  });

  it("uses dry_run message when kind is dry_run", async () => {
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "advanced" });
    const out = await requireAssuranceWorkspaceForAutopilotApi({} as never, "o1", "dry_run");
    expect(out?.status).toBe(403);
    const body = await out!.json();
    expect(String(body.error)).toContain("dry-run");
  });
});
