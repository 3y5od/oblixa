import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from: vi.fn() })),
}));

describe("seedRenewalPlaybook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns when unauthenticated without touching contracts", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const adminFrom = vi.fn();
    const { createAdminClient } = await import("@/lib/supabase/server");
    vi.mocked(createAdminClient).mockResolvedValue({ from: adminFrom } as never);
    const { seedRenewalPlaybook } = await import("@/actions/renewal-playbook");
    await seedRenewalPlaybook("550e8400-e29b-41d4-a716-446655440000");
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("returns when contract id is not a uuid", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const adminFrom = vi.fn();
    const { createAdminClient } = await import("@/lib/supabase/server");
    vi.mocked(createAdminClient).mockResolvedValue({ from: adminFrom } as never);
    const { seedRenewalPlaybook } = await import("@/actions/renewal-playbook");
    await seedRenewalPlaybook("x");
    expect(adminFrom).not.toHaveBeenCalled();
  });
});
