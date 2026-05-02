import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/instrumentation-client.ts", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/debugging-sweep/catalog-index.server",
              message: "Server-only debugging sweep catalog — use @/lib/debugging-sweep/types-only from client bundles.",
            },
            {
              name: "@/lib/debugging-sweep/catalog-generated",
              message: "Generated catalog is server-only — use @/lib/debugging-sweep/types-only.",
            },
            {
              name: "@/lib/debugging-sweep/register-runtime",
              message: "Runtime registration is server-only.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "node_modules/**",
    "src/lib/debugging-sweep/catalog-generated.json",
    "src/lib/debugging-sweep/stubs/catalog-stubs.generated.ts",
  ]),
]);

export default eslintConfig;
