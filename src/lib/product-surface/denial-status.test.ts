import { describe, expect, it } from "vitest";
import { statusForEligibilityDenial, denialStatusMatrix } from "@/lib/product-surface/denial-status";

describe("v8 denial status mapping", () => {
  it("maps unauthenticated to 401", () => {
    expect(statusForEligibilityDenial("unauthenticated")).toBe(401);
  });

  it("maps hidden and mode denials to 404", () => {
    expect(statusForEligibilityDenial("hidden_by_module_config")).toBe(404);
    expect(statusForEligibilityDenial("insufficient_workspace_mode")).toBe(404);
  });

  it("falls back to provided status for null denial class", () => {
    expect(statusForEligibilityDenial(null, 403)).toBe(403);
    expect(statusForEligibilityDenial(undefined, 404)).toBe(404);
  });

  it("exposes a complete matrix", () => {
    const matrix = denialStatusMatrix();
    expect(matrix.registry_missing_or_mapping_missing).toBe(404);
    expect(matrix.unauthorized_role).toBe(403);
    expect(matrix.org_context_unresolved).toBe(403);
  });
});
