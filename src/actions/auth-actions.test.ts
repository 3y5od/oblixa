import { describe, expect, it, vi, beforeEach } from "vitest";

const rlMocks = vi.hoisted(() => ({
  rateLimitCheck: vi.fn(),
  getClientIpFromHeaders: vi.fn(async () => "127.0.0.1"),
}));

const authServerMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ data: {}, error: null })),
  getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  createAdminClient: vi.fn(async () => ({})),
  getDeterministicMembership: vi.fn(async () => ({
    organization_id: "org-1",
    role: "admin" as const,
  })),
}));

const calGateMocks = vi.hoisted(() => ({
  resolveBlockingCalibrationPathForAdminOrg: vi.fn(async () => null as string | null),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck: rlMocks.rateLimitCheck,
    getClientIpFromHeaders: rlMocks.getClientIpFromHeaders,
  };
});

vi.mock("@/lib/onboarding/calibration-gate", () => ({
  resolveBlockingCalibrationPathForAdminOrg: calGateMocks.resolveBlockingCalibrationPathForAdminOrg,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: authServerMocks.signInWithPassword,
      signUp: authServerMocks.signUp,
      getUser: authServerMocks.getUser,
    },
  })),
  createAdminClient: authServerMocks.createAdminClient,
  getDeterministicMembership: authServerMocks.getDeterministicMembership,
  ensureUserOrg: vi.fn(async () => undefined),
}));

vi.mock("@/lib/app-url", () => ({
  resolveAppBaseUrl: vi.fn(async () => "http://localhost:3000"),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

describe("auth actions rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    rlMocks.rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 60_000 });
    calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue(null);
  });

  it("signIn returns error when rate limited", async () => {
    const { signIn } = await import("@/actions/auth");
    const fd = new FormData();
    fd.set("email", "a@b.co");
    fd.set("password", "secret");
    const res = await signIn(fd);
    expect(res).toEqual({
      error: "Too many sign-in attempts. Try again in a few minutes.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("signUp returns error when rate limited", async () => {
    const { signUp } = await import("@/actions/auth");
    const fd = new FormData();
    fd.set("email", "a@b.co");
    fd.set("password", "secret");
    fd.set("fullName", "T");
    const res = await signUp(fd);
    expect(res).toEqual({
      error: "Too many sign-up attempts. Try again later.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  describe("signIn blocking calibration redirect", () => {
    beforeEach(() => {
      rlMocks.rateLimitCheck.mockResolvedValue({ ok: true });
    });

    it("returns redirectTo /dashboard when resolveBlockingCalibrationPathForAdminOrg returns null", async () => {
      calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue(null);
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({ redirectTo: "/dashboard" });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns redirectTo /onboarding/calibration when the gate returns that path", async () => {
      calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue("/onboarding/calibration");
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({ redirectTo: "/onboarding/calibration" });
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
