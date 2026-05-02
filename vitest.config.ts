import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Extra per-directory floors for `src/lib/product-surface` (use with full `npm run test:logic:coverage`, not tiny subsets). */
const watermarkDirs =
  process.env.VITEST_WATERMARKS === "1" || process.env.VITEST_WATERMARKS === "true"
    ? {
        perDirectory: {
          "src/lib/product-surface": {
            lines: 1,
            functions: 1,
            branches: 1,
            statements: 1,
          },
        },
      }
    : {};

const minimalFloor = { lines: 1, functions: 1, branches: 1, statements: 1 };
const maximalCoverageRatchet =
  process.env.VITEST_COVERAGE_MAXIMAL === "1" || process.env.VITEST_COVERAGE_MAXIMAL === "true"
    ? {
        perDirectory: {
          "src/lib/auth": { ...minimalFloor },
          "src/lib/rate-limit": { ...minimalFloor },
          "src/lib/compliance": { ...minimalFloor },
          "src/lib/observability": { ...minimalFloor },
          "src/lib/errors": { ...minimalFloor },
        },
      }
    : {};

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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.v10.test.ts"],
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
        "src/lib/v10-*.ts",
        "src/lib/product-surface/**/*.ts",
        "src/lib/security/**/*.ts",
        "src/lib/observability/**/*.ts",
        "src/lib/auth/**/*.ts",
        "src/lib/errors/**/*.ts",
        "src/lib/ui/**/*.ts",
        "src/lib/stripe.ts",
        "src/lib/rate-limit/**/*.ts",
        "src/lib/compliance/**/*.ts",
        "src/actions/**/*.ts",
        "src/app/api/**/*.ts",
        "src/instrumentation.ts",
        "src/instrumentation-client.ts",
        "src/test-utils/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/src/lib/qa/**"],
      thresholds: {
        lines: 51,
        functions: 61,
        branches: 46,
        statements: 49,
        ...watermarkDirs,
        ...maximalCoverageRatchet,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/lib/debugging-sweep/vitest-server-only-stub.ts"),
    },
  },
});
