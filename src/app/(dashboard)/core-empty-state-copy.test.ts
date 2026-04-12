import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS } from "../../../e2e/authenticated-a11y-paths";

const EXTRA_CORE_COPY_FILES = [
  "src/app/(dashboard)/reports/page.tsx",
  "src/app/(dashboard)/contracts/renewals/page.tsx",
] as const;

const BANNED_CORE_UPSELL_SNIPPETS = [
  "available in Advanced or Assurance workspaces",
  "unlock when an admin enables Advanced or Assurance mode",
  "upgrade to Advanced",
  "upgrade to Assurance",
] as const;

function dashboardPageFileForRoute(route: string): string | null {
  const trim = route.replace(/^\//, "");
  const segments = trim.split("/").filter(Boolean);
  const abs = join(process.cwd(), "src/app/(dashboard)", ...segments, "page.tsx");
  return existsSync(abs) ? abs.replace(`${process.cwd()}/`, "") : null;
}

const A11Y_PAGE_FILES = [...new Set([...EXTRA_CORE_COPY_FILES, ...AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS.map(dashboardPageFileForRoute).filter(Boolean)])] as string[];

describe("core empty-state copy stays non-upsell (V7 §22.3)", () => {
  for (const rel of A11Y_PAGE_FILES) {
    it(`does not include advanced/assurance upsell wording in ${rel}`, () => {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      for (const phrase of BANNED_CORE_UPSELL_SNIPPETS) {
        expect(raw.includes(phrase)).toBe(false);
      }
    });
  }
});
