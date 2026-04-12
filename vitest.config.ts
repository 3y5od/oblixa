import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Forks keep large suites + jsdom tests stable (threads occasionally OOM locally).
    pool: "forks",
    maxWorkers: process.env.CI ? "100%" : "50%",
    coverage: {
      provider: "v8",
      include: [
        "src/lib/v5/**/*.ts",
        "src/lib/v5/**/*.tsx",
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
