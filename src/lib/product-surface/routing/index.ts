export {
  minWorkspaceModeForPath,
  isPathAllowedForWorkspaceMode,
} from "@/lib/product-surface/routes";

export {
  assertWorkspaceModeAtLeast,
  assertAssuranceWorkspaceOrRedirect,
  assertCoreUtilitySurfaceOrRedirect,
  assertPagePathEligibleOrNotFound,
} from "@/lib/product-surface/route-guard";
