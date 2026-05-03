import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const minimalFloor = { lines: 1, functions: 1, branches: 1, statements: 1 };
const maximalUiRatchet =
  process.env.VITEST_COVERAGE_MAXIMAL === "1" || process.env.VITEST_COVERAGE_MAXIMAL === "true"
    ? {
        perDirectory: {
          "src/components/auth": { ...minimalFloor },
          "src/components/layout": { ...minimalFloor },
        },
      }
    : {};

const UI_TEST_FILES = [
  "src/**/*.ui.test.ts",
  "src/**/*.ui.test.tsx",
  "src/components/ui/operational-summary-card.test.tsx",
  "src/components/ui/v10-recoverable-state.test.tsx",
  "src/components/ui/axe-smoke.test.tsx",
  "src/components/onboarding/calibration-wizard.review.test.tsx",
  "src/components/onboarding/calibration-wizard-debounce.test.tsx",
  "src/components/onboarding/calibration-wizard.a11y.test.tsx",
  "src/app/(dashboard)/settings/product/settings-product-calibration-summary.test.tsx",
  "src/app/(dashboard)/settings/product/settings-product-calibration-export.test.tsx",
] as const;

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [...UI_TEST_FILES],
    setupFiles: ["./src/test-utils/setup-ui.ts"],
    pool: "forks",
    // Match vitest.config.ts: conservative workers under CI coverage to avoid fork-pool flakes.
    maxWorkers: process.env.CI ? "50%" : "25%",
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage/ui",
      include: [
        "src/components/layout/header.tsx",
        "src/components/layout/sidebar.tsx",
        "src/components/layout/command-palette.tsx",
        "src/components/layout/legal-footer.tsx",
        "src/components/layout/skip-link.tsx",
        "src/components/layout/workspace-required-state.tsx",
        "src/components/ui/operational-summary-card.tsx",
        "src/components/ui/v10-recoverable-state.tsx",
        "src/components/ui/empty-state.tsx",
        "src/components/ui/inline-skeleton.tsx",
        "src/components/ui/queue-item-card.tsx",
        "src/components/ui/permission-eligibility-hint.tsx",
        "src/components/ui/status-badge.tsx",
        "src/components/contracts/contract-pagination.tsx",
        "src/components/contracts/download-button.tsx",
        "src/components/contracts/add-field-form.tsx",
        "src/components/contracts/review-save-next-telemetry-link.tsx",
        "src/components/dashboard/dashboard-quick-filter-card.tsx",
        "src/components/auth/auth-form.tsx",
        "src/components/auth/auth-legal-footer.tsx",
        "src/components/landing/landing-page.tsx",
        "src/components/landing/marketing-site-chrome.tsx",
        "src/components/onboarding/calibration-wizard.tsx",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/src/lib/qa/**"],
      thresholds: {
        lines: 21,
        functions: 20,
        branches: 15,
        statements: 21,
        ...maximalUiRatchet,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

