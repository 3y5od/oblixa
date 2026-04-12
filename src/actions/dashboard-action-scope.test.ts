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

  it("returns before auth when queue key is invalid", async () => {
    const fd = new FormData();
    fd.set("queueKey", "invalid");
    const { setDashboardQueuePinForm } = await import("@/actions/dashboard");
    await setDashboardQueuePinForm(fd);
    expect(serverMocks.createClient).not.toHaveBeenCalled();
  });
});
