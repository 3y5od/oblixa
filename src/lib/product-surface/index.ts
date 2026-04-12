/**
 * Product surface (docs/refinement.md §4–§10, §19–§21).
 * @see REFINEMENT_TRACE in refinement-trace.ts for spec → file mapping.
 */
export {
  REFINEMENT_TRACE,
  REFINEMENT_OBJECTIVES,
  REFINEMENT_V7_TRACE_STRINGS,
} from "@/lib/product-surface/refinement-trace";
export type { NotificationProductTier, AdvancedNavModuleKey, WorkspaceProductMode } from "@/lib/product-surface/types";
export type { AssuranceNavModuleKey, ProductSearchScope } from "@/lib/product-surface/types";
export {
  buildProductSurfaceContext,
  loadProductSurfaceContext,
  isAdvancedModuleHidden,
  isAssuranceModuleHidden,
  parseWorkspaceMode,
  type ProductSurfaceContext,
} from "@/lib/product-surface/context";
export { minWorkspaceModeForPath, isPathAllowedForWorkspaceMode } from "@/lib/product-surface/routes";
export {
  PRODUCT_FEATURE_REGISTRY,
  displayLabelForFeature,
  featureFamilyForApiPath,
  featureFamilyForPath,
  minWorkspaceModeForRegistryPath,
  eligibleReportTypeOptionsForWorkspaceMode,
  minWorkspaceModeForReportType,
  minWorkspaceModeForReportsHash,
  REPORT_HASH_MAP,
  REPORT_TYPE_MAP,
  SEARCH_INDEX_CLASSES,
  workspaceModeAllowsReportType,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";
export {
  evaluateFeatureEligibility,
  type FeatureDiscoverability,
  type FeatureEligibility,
} from "@/lib/product-surface/eligibility";
export {
  featureFamilyForHref,
  isHrefEligibleForNavSurface,
  isHrefEligibleForNavSurfaceWithEnvFlags,
  isHrefEligibleForProductSurface,
  productSurfaceContextFromNavSurface,
} from "@/lib/product-surface/href-eligibility";
export { getCmdkSearchJumpItems, type CmdkSearchJumpItem } from "@/lib/product-surface/cmdk-search-jumps";
export {
  COMMAND_PALETTE_OPEN_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/product-surface/command-palette-bridge";
export type {
  FeatureState,
  FeatureLifecycle,
  FeatureFamilyKey,
  ProductFeatureDef,
  SearchIndexClassDef,
  ReportHashMapEntry,
  ReportTypeMapEntry,
} from "@/lib/product-surface/feature-registry";
export {
  isNavItemVisibleForSurface,
  isNavChildVisibleForSurface,
  filterNavBadgesForSurface,
  roleMayBypassProductRoute,
  toNavSurfaceInput,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
export {
  assertWorkspaceModeAtLeast,
  assertAssuranceWorkspaceOrRedirect,
  assertCoreUtilitySurfaceOrRedirect,
} from "@/lib/product-surface/route-guard";
export { filterAuditEventsForWorkspaceMode } from "@/lib/product-surface/audit-events-filter";
export {
  ROUTE_INVENTORY,
  coreDashboardPageRelPaths,
  inventoryTierForPath,
  type RouteInventoryEntry,
  type RouteInventoryTier,
} from "@/lib/product-surface/route-inventory";
export {
  CMDK_EXTRA_NAV_ITEMS,
  HOME_SECTION_IDS,
  cmdkResultSortKey,
  cmdkFilterRecentHrefsForSurface,
  isCmdkHrefAllowed,
  isHomeBlockAllowed,
  isNotificationCategoryAllowed,
  isRouteAllowedForWorkspacePath,
  type HomeSectionId,
} from "@/lib/product-surface/resolver";
