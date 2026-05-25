import { describe, expect, it, vi } from "vitest";
import type { AdminClient } from "@/lib/assurance/service";

const getV6 = vi.fn();

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getV6(...args),
}));

describe("resolvePostAuthRedirectPath (§11.3)", () => {
  it("does not apply default landing using mode-only shortcuts — uses resolveEffectiveLandingPath", async () => {
    getV6.mockResolvedValue({
      workspace_mode: "core",
      default_landing_path: "/decisions",
    });
    const { resolvePostAuthRedirectPath } = await import("@/lib/auth/post-auth-redirect");
    const admin = {} as unknown as AdminClient;
    const out = await resolvePostAuthRedirectPath(admin, "org-1", "/dashboard");
    expect(out).not.toBe("/decisions");
    expect(out).toBe("/dashboard");
  });

  it("honors eligible org default landing for the resolved workspace mode", async () => {
    getV6.mockResolvedValue({
      workspace_mode: "advanced",
      default_landing_path: "/decisions",
    });
    const { resolvePostAuthRedirectPath } = await import("@/lib/auth/post-auth-redirect");
    const admin = {} as unknown as AdminClient;
    const out = await resolvePostAuthRedirectPath(admin, "org-1", "/dashboard");
    expect(out).toBe("/decisions");
  });
});
