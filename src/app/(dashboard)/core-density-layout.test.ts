import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_PAGES = [
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/work/page.tsx",
  "src/app/(dashboard)/contracts/page.tsx",
  "src/app/(dashboard)/contracts/review/page.tsx",
] as const;

// v22: pages may delegate layout to a wrapper component (e.g. CoreDashboard
// owns the ui-page-stack class for the dashboard route). The test now
// accepts either: (a) the page itself contains the tokenized class, OR
// (b) the page imports a known wrapper component that owns the class.
const LAYOUT_WRAPPER_COMPONENTS: Record<string, string> = {
  CoreDashboard: "src/components/dashboard/core-dashboard.tsx",
};

function hasTokenizedLayout(raw: string): boolean {
  if (raw.includes("ui-page-stack") || raw.includes("ui-panel") || raw.includes("ui-card")) {
    return true;
  }
  for (const [componentName, relPath] of Object.entries(LAYOUT_WRAPPER_COMPONENTS)) {
    if (raw.includes(componentName)) {
      try {
        const wrapperRaw = readFileSync(join(process.cwd(), relPath), "utf8");
        if (
          wrapperRaw.includes("ui-page-stack") ||
          wrapperRaw.includes("ui-panel") ||
          wrapperRaw.includes("ui-card")
        ) {
          return true;
        }
      } catch {
        // wrapper file missing — fall through to other wrappers
      }
    }
  }
  return false;
}

describe("core density layout pass", () => {
  for (const rel of CORE_PAGES) {
    it(`keeps tokenized page stack structure in ${rel}`, () => {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(hasTokenizedLayout(raw)).toBe(true);
    });
  }
});
