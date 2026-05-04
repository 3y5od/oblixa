import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const adminFrom = vi.fn();
const revalidatePath = vi.fn();
const getOrgMemberRole = vi.fn();
const canEditContracts = vi.fn();
const emitVisibleMutationErrorTelemetry = vi.fn();
const loadProductSurfaceContext = vi.fn();
const evaluateFeatureEligibility = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
  createAdminClient: vi.fn(async () => ({ from: adminFrom })),
}));

vi.mock("@/lib/permissions", () => ({
  canEditContracts,
  getOrgMemberRole,
}));

vi.mock("@/lib/product-surface/context", () => ({
  loadProductSurfaceContext,
}));

vi.mock("@/lib/product-surface/eligibility", () => ({
  evaluateFeatureEligibility,
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitVisibleMutationErrorTelemetry,
}));

function makeMaybeSingleBuilder<T>(data: T) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };
}

function makeUpdateBuilder() {
  return {
    eq: vi.fn().mockReturnThis(),
    error: null,
  };
}

describe("exceptions server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getOrgMemberRole.mockResolvedValue("editor");
    canEditContracts.mockReturnValue(true);
    loadProductSurfaceContext.mockResolvedValue({ mode: "core" });
    evaluateFeatureEligibility.mockReturnValue({ allowed: true });
  });

  it("assignException rejects when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { assignException } = await import("@/actions/exceptions");
    const result = await assignException({
      exceptionId: "550e8400-e29b-41d4-a716-446655440000",
      ownerId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result).toEqual({ error: "Not authenticated" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("resolveException rejects when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { resolveException } = await import("@/actions/exceptions");
    const result = await resolveException({
      exceptionId: "550e8400-e29b-41d4-a716-446655440000",
      resolutionNote: "done",
    });
    expect(result).toEqual({ error: "Not authenticated" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("reopenException rejects when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { reopenException } = await import("@/actions/exceptions");
    const result = await reopenException({
      exceptionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result).toEqual({ error: "Not authenticated" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("resolveException rejects already resolved exceptions before mutation", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updateBuilder = makeUpdateBuilder();
    adminFrom.mockImplementation((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn(() =>
            makeMaybeSingleBuilder({
              id: "550e8400-e29b-41d4-a716-446655440000",
              contract_id: "550e8400-e29b-41d4-a716-446655440010",
              organization_id: "550e8400-e29b-41d4-a716-446655440020",
              status: "resolved",
              owner_id: "550e8400-e29b-41d4-a716-446655440030",
              due_date: null,
            })
          ),
          update: vi.fn(() => updateBuilder),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const { resolveException } = await import("@/actions/exceptions");
    const result = await resolveException({
      exceptionId: "550e8400-e29b-41d4-a716-446655440000",
      resolutionNote: "done",
    });

    expect(result).toEqual({ error: "Only active exceptions can be resolved." });
    expect(updateBuilder.eq).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(emitVisibleMutationErrorTelemetry).not.toHaveBeenCalled();
  });

  it("reopenException rejects active exceptions before mutation", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updateBuilder = makeUpdateBuilder();
    adminFrom.mockImplementation((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn(() =>
            makeMaybeSingleBuilder({
              id: "550e8400-e29b-41d4-a716-446655440000",
              contract_id: "550e8400-e29b-41d4-a716-446655440010",
              organization_id: "550e8400-e29b-41d4-a716-446655440020",
              status: "open",
              owner_id: "550e8400-e29b-41d4-a716-446655440030",
              due_date: null,
            })
          ),
          update: vi.fn(() => updateBuilder),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const { reopenException } = await import("@/actions/exceptions");
    const result = await reopenException({
      exceptionId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result).toEqual({ error: "Only resolved exceptions can be reopened." });
    expect(updateBuilder.eq).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(emitVisibleMutationErrorTelemetry).not.toHaveBeenCalled();
  });

  it("resolveException rejects resolution actions that are unavailable in the current workspace", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updateBuilder = makeUpdateBuilder();
    adminFrom.mockImplementation((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn(() =>
            makeMaybeSingleBuilder({
              id: "550e8400-e29b-41d4-a716-446655440000",
              contract_id: "550e8400-e29b-41d4-a716-446655440010",
              organization_id: "550e8400-e29b-41d4-a716-446655440020",
              status: "open",
              severity: "medium",
              owner_id: "550e8400-e29b-41d4-a716-446655440030",
              due_date: null,
            })
          ),
          update: vi.fn(() => updateBuilder),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
    evaluateFeatureEligibility.mockReturnValueOnce({ allowed: false });

    const { resolveException } = await import("@/actions/exceptions");
    const result = await resolveException({
      exceptionId: "550e8400-e29b-41d4-a716-446655440000",
      resolutionAction: "campaign_created",
      resolutionNote: "Escalate via campaign",
    });

    expect(result).toEqual({ error: "This resolution path is not available in the current workspace configuration." });
    expect(loadProductSurfaceContext).toHaveBeenCalled();
    expect(evaluateFeatureEligibility).toHaveBeenCalledWith(
      expect.anything(),
      "campaigns",
      expect.objectContaining({ surfaceIdentifier: "/contracts/exceptions" })
    );
    expect(updateBuilder.eq).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
