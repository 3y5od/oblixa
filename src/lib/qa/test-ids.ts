export const MAIN_CONTENT_ID = "main-content";

export const shellTestIds = {
  sidebarDesktop: "sidebar-desktop",
  sidebarCollapseToggle: "sidebar-collapse-toggle",
  sidebarMobileOpen: "sidebar-mobile-open",
  sidebarMobileDrawer: "sidebar-mobile-drawer",
  sidebarSignOut: "sidebar-sign-out",
  primaryNav: "primary-nav",
  headerSearch: "workspace-header-search",
  commandPaletteTrigger: "command-palette-trigger",
  commandPaletteRoot: "command-palette-root",
  commandPaletteInput: "command-palette-input",
  commandPaletteResults: "command-palette-results",
} as const;

export const surfaceTestIds = {
  contractsTable: "contracts-table",
  dashboardStats: "dashboard-stats",
  contractsPageSnapshot: "contracts-page-snapshot",
  workPageSummary: "work-page-summary",
  moreJumpPoints: "more-jump-points",
  externalSubmitForm: "external-submit-form",
  /** Error state when `/api/external-actions/.../status` fails */
  externalSubmitLoadError: "external-submit-load-error",
} as const;

