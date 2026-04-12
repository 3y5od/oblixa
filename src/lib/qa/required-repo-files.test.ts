import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_PATHS = [
  "playwright.config.ts",
  "e2e/authenticated.spec.ts",
  "e2e/authenticated-a11y-paths.ts",
  "e2e/refinement-optional-fixtures.spec.ts",
  "src/proxy.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
  "src/instrumentation-client.ts",
  "src/instrumentation.ts",
  "semgrep/oblixa-security.yml",
  "semgrep/oblixa-performance.yml",
  "scripts/performance-static-audit-allowlist.txt",
  "scripts/security-static-audit-allowlist.txt",
  "scripts/api-route-test-allowlist.txt",
  ".github/dependabot.yml",
  ".nvmrc",
  ".github/CODEOWNERS",
];

describe("required repo files exist", () => {
  it.each(REQUIRED_PATHS)("%s", (rel) => {
    const abs = path.join(process.cwd(), rel);
    expect(fs.existsSync(abs), `Missing ${rel}`).toBe(true);
  });
});
