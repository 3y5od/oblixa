import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import type { ProductSurfaceActionContext } from "./product-surface-settings-helpers";

export async function validateWorkspaceModeBillingEligibility(input: {
  admin: ProductSurfaceActionContext["admin"];
  orgId: string;
  mode: WorkspaceProductMode;
  prevSettings: unknown;
}): Promise<string | null> {
  void input;
  // Workspace product mode controls IA/navigation and must not depend on billing state.
  // Commercial limits remain enforced at their feature-specific mutation/export boundaries.
  return null;
}