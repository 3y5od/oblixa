import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_TEST_EXCLUDES = [
  "src/**/*.ui.test.ts",
  "src/**/*.ui.test.tsx",
  "src/components/ui/operational-summary-card.test.tsx",
  "src/components/ui/axe-smoke.test.tsx",
  "src/components/onboarding/calibration-wizard.review.test.tsx",
  "src/components/onboarding/calibration-wizard-debounce.test.tsx",
  "src/components/onboarding/calibration-wizard.a11y.test.tsx",
  "src/app/(dashboard)/settings/product/settings-product-calibration-summary.test.tsx",
  "src/app/(dashboard)/settings/product/settings-product-calibration-export.test.tsx",
] as const;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [...UI_TEST_EXCLUDES],
    // Forks keep large suites + jsdom tests stable (threads occasionally OOM locally).
    pool: "forks",
    // CI ran into timeout flakes when many async route tests contend.
    maxWorkers: process.env.CI ? "75%" : "50%",
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/v5/**/*.ts",
        "src/lib/v5/**/*.tsx",
        "src/lib/product-surface/**/*.ts",
        "src/lib/security/**/*.ts",
        "src/lib/observability/**/*.ts",
        "src/lib/auth/**/*.ts",
        "src/lib/errors/**/*.ts",
        "src/lib/ui/**/*.ts",
        "src/lib/stripe.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/src/lib/qa/**"],
      thresholds: {
        lines: 50,
        functions: 60,
        branches: 45,
        statements: 48,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
