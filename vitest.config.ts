import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // CI runners are often 2 vCPU; explicit threads pool avoids fork overhead on Linux.
    pool: "threads",
    maxWorkers: process.env.CI ? "100%" : undefined,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/v5/**/*.ts",
        "src/lib/security/**/*.ts",
        "src/lib/observability/**/*.ts",
        "src/lib/stripe.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
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
