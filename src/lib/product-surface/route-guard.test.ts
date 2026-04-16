import { describe, expect, it, vi, beforeEach } from "vitest";

const redirectMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
}));

const getAuthContext = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getAuthContext: () => getAuthContext(),
}));

const loadProductSurfaceContext = vi.fn();
vi.mock("@/lib/product-surface/context", () => ({
  loadProductSurfaceContext: (...args: unknown[]) => loadProductSurfaceContext(...args),
}));

const resolveFeatureMappingForPagePath = vi.fn();
vi.mock("@/lib/product-surface/v8-surface-mapping", () => ({
  resolveFeatureMappingForPagePath: (...args: unknown[]) => resolveFeatureMappingForPagePath(...args),
}));

const evaluateFeatureEligibility = vi.fn();
vi.mock("@/lib/product-surface/eligibility", () => ({
  evaluateFeatureEligibility: (...args: unknown[]) => evaluateFeatureEligibility(...args),
}));

describe("assertCoreUtilitySurfaceOrRedirect", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    notFoundMock.mockReset();
    getAuthContext.mockReset();
    loadProductSurfaceContext.mockReset();
    resolveFeatureMappingForPagePath.mockReset();
    evaluateFeatureEligibility.mockReset();
  });

  it("redirects non-admin Core users from §10.4 utility layouts", async () => {
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "editor",
    });
    loadProductSurfaceContext.mockResolvedValue({ mode: "core", v6: {} });

    const { assertCoreUtilitySurfaceOrRedirect } = await import("@/lib/product-surface/route-guard");
    await assertCoreUtilitySurfaceOrRedirect();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("does not redirect admins (support bypass)", async () => {
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "admin",
    });
    loadProductSurfaceContext.mockResolvedValue({ mode: "core", v6: {} });

    const { assertCoreUtilitySurfaceOrRedirect } = await import("@/lib/product-surface/route-guard");
    await assertCoreUtilitySurfaceOrRedirect();

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not redirect Advanced mode", async () => {
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "editor",
    });
    loadProductSurfaceContext.mockResolvedValue({ mode: "advanced", v6: {} });

    const { assertCoreUtilitySurfaceOrRedirect } = await import("@/lib/product-surface/route-guard");
    await assertCoreUtilitySurfaceOrRedirect();

    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("assertWorkspaceModeAtLeast", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    notFoundMock.mockReset();
    getAuthContext.mockReset();
    loadProductSurfaceContext.mockReset();
    resolveFeatureMappingForPagePath.mockReset();
    evaluateFeatureEligibility.mockReset();
  });

  it("calls notFound for non-admin users below required mode", async () => {
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "editor",
    });
    loadProductSurfaceContext.mockResolvedValue({ mode: "core", v6: {} });
    const { assertWorkspaceModeAtLeast } = await import("@/lib/product-surface/route-guard");
    await assertWorkspaceModeAtLeast("advanced");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not call notFound for admins", async () => {
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "admin",
    });
    const { assertWorkspaceModeAtLeast } = await import("@/lib/product-surface/route-guard");
    await assertWorkspaceModeAtLeast("assurance");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("assertPagePathEligibleOrNotFound", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    notFoundMock.mockReset();
    getAuthContext.mockReset();
    loadProductSurfaceContext.mockReset();
    resolveFeatureMappingForPagePath.mockReset();
    evaluateFeatureEligibility.mockReset();
  });

  it("allows exempt mappings", async () => {
    resolveFeatureMappingForPagePath.mockReturnValue({
      status: "exempt",
      exemptClass: "legal_marketing",
      reason: "Public legal page",
      surfaceType: "page",
      identifier: "/privacy",
    });
    const { assertPagePathEligibleOrNotFound } = await import("@/lib/product-surface/route-guard");
    await assertPagePathEligibleOrNotFound("/privacy");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("fails closed when mapping is unmapped", async () => {
    resolveFeatureMappingForPagePath.mockReturnValue({
      status: "unmapped",
      surfaceType: "page",
      identifier: "/unknown-governed",
    });
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "editor",
    });
    const { assertPagePathEligibleOrNotFound } = await import("@/lib/product-surface/route-guard");
    await assertPagePathEligibleOrNotFound("/unknown-governed");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("fails closed when eligibility denies mapped path", async () => {
    resolveFeatureMappingForPagePath.mockReturnValue({
      status: "mapped",
      featureFamily: "decisions",
      surfaceType: "page",
      identifier: "/decisions",
    });
    getAuthContext.mockResolvedValue({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
      role: "editor",
    });
    loadProductSurfaceContext.mockResolvedValue({
      mode: "core",
      role: "editor",
    });
    evaluateFeatureEligibility.mockReturnValue({
      allowed: false,
      discoverability: "suppressed",
      reason: "workspace_mode_ineligible",
      denialClass: "insufficient_workspace_mode",
      resolvedDiscoverability: "hidden",
      telemetry: {
        featureKey: "decisions",
        mode: "core",
        role: "editor",
        isAdmin: false,
        surfaceType: "page",
        surfaceIdentifier: "/decisions",
      },
      definition: {},
    });
    const { assertPagePathEligibleOrNotFound } = await import("@/lib/product-surface/route-guard");
    await assertPagePathEligibleOrNotFound("/decisions");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
