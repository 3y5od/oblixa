/**
 * Product surface (product-surface policy §4–§10, §19–§21).
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
  v8AdminRevealPolicyForFeature,
  v8CommandVocabularyForFeature,
  v8DiscoverabilityForFeature,
  v8OwningActionIdsForFeature,
  v8OwningApiPrefixesForFeature,
  v8OwningPagePatternsForFeature,
  v8SearchVocabularyForFeature,
} from "@/lib/product-surface/feature-registry";
export {
  evaluateFeatureEligibility,
  type FeatureDiscoverability,
  type FeatureEligibility,
  type V8EligibilityDenialClass,
} from "@/lib/product-surface/eligibility";
export {
  statusForEligibilityDenial,
  v8DenialStatusMatrix,
} from "@/lib/product-surface/v8-denial-status";
export {
  featureFamilyForHref,
  isHrefEligibleForNavSurface,
  isHrefEligibleForProductSurface,
  productSurfaceContextFromNavSurface,
} from "@/lib/product-surface/href-eligibility";
export { isHrefEligibleForNavSurfaceWithEnvFlags } from "@/lib/product-surface/href-eligibility-server";
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
  V8AdminRevealPolicy,
  V8FeatureDiscoverability,
} from "@/lib/product-surface/feature-registry";
export {
  allV8ExemptSurfaceRules,
  resolveActionExemptSurface,
  resolveApiExemptSurface,
  resolvePageExemptSurface,
  type V8ExemptSurfaceClass,
  type V8ExemptSurfaceRule,
} from "@/lib/product-surface/v8-exempt-surfaces";
export {
  resolveFeatureMappingForAction,
  resolveFeatureMappingForApiPath,
  resolveFeatureMappingForPagePath,
  type V8SurfaceMapping,
  type V8SurfaceType,
} from "@/lib/product-surface/v8-surface-mapping";
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
  assertPagePathEligibleOrNotFound,
} from "@/lib/product-surface/route-guard";
export { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/v8-request-pathname";
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
  isRouteAllowedForWorkspacePath,
  type HomeSectionId,
} from "@/lib/product-surface/resolver";
export { isNotificationCategoryAllowed } from "@/lib/product-surface/resolver-server";
export {
  CORE_FORBIDDEN_WORKFLOW_DESTINATION_TERMS,
  MORE_JUMP_DESTINATION_KEYS,
  WORKFLOW_DESTINATIONS,
  WORKFLOW_DESTINATION_KEYS,
  assertNoForbiddenCoreWorkflowDestinationTerms,
  buildWorkflowDestinationManifest,
  listMoreJumpDestinations,
  listWorkflowDestinationsForSurface,
  resolveMorePageChrome,
  resolveWorkflowDestination,
  workflowDestinationByKey,
  workflowDestinationForHref,
  type ResolvedWorkflowDestination,
  type WorkflowDestinationCopy,
  type WorkflowDestinationDef,
  type WorkflowDestinationKey,
  type WorkflowDestinationManifestEntry,
  type WorkflowDestinationPlacement,
  type WorkflowDestinationSurface,
} from "@/lib/product-surface/workflow-destinations";
