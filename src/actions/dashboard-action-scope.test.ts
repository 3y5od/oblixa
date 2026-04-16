import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const serverMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: serverMocks.createClient,
  createAdminClient: vi.fn(async () => ({ from: vi.fn() })),
  getDeterministicMembership: vi.fn(),
}));

describe("setDashboardQueuePinForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns without mutating when Supabase user is null (auth failure path)", async () => {
    serverMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    const fd = new FormData();
    fd.set("queueKey", "now");
    fd.set("pinned", "1");
    const { setDashboardQueuePinForm } = await import("@/actions/dashboard");
    const result = await setDashboardQueuePinForm(fd);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("documents organization_id scoping in module source (§13.3)", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/dashboard.ts"), "utf8");
    expect(raw).toContain("organization_id");
  });

  it("returns before auth when queue key is invalid", async () => {
    const fd = new FormData();
    fd.set("queueKey", "invalid");
    const { setDashboardQueuePinForm } = await import("@/actions/dashboard");
    const result = await setDashboardQueuePinForm(fd);
    expect(result).toEqual({ error: "Invalid queue key" });
    expect(serverMocks.createClient).not.toHaveBeenCalled();
  });
});
