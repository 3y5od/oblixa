import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAuthenticatedA11yAndViewportPaths } from "../../../e2e/authenticated-a11y-paths";

const DASHBOARD_ROOT = path.join(process.cwd(), "src", "app", "(dashboard)");

/**
 * Map public path to expected page.tsx under (dashboard). Dynamic segments not in the A11y list.
 */
function dashboardPagePath(route: string): string {
  const inner = route.replace(/^\//, "");
  return path.join(DASHBOARD_ROOT, ...inner.split("/"), "page.tsx");
}

describe("A11y matrix paths resolve to dashboard page.tsx", () => {
  it("each merged A11y/viewport path has a page file", () => {
    for (const route of getAuthenticatedA11yAndViewportPaths()) {
      const abs = dashboardPagePath(route);
      expect(fs.existsSync(abs), `Missing ${path.relative(process.cwd(), abs)} for ${route}`).toBe(
        true
      );
    }
  });
});
