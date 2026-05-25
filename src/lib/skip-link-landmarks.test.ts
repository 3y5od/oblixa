import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/**
 * Mirrors `scripts/check-shell-landmarks.mjs` — skip link + single dashboard `main` (V9 §25.1 / plan skip-link todo).
 */
describe("skip link and shell landmarks", () => {
  it("keeps dashboard main, skip target, sidebar, and footer landmarks wired", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(layout).toContain("<main");
    expect(layout).toContain(`id={MAIN_CONTENT_ID}`);
    expect(layout).toContain("MAIN_CONTENT_ID");

    const skip = readFileSync(join(process.cwd(), "src/components/layout/skip-link.tsx"), "utf8");
    expect(skip).toContain("MAIN_CONTENT_ID");
    expect(skip).toContain("Skip to main content");

    const sidebar = readFileSync(join(process.cwd(), "src/components/layout/sidebar.tsx"), "utf8");
    expect(sidebar).toContain('aria-label="Workspace"');

    const footer = readFileSync(join(process.cwd(), "src/components/layout/legal-footer.tsx"), "utf8");
    expect(footer).toContain('aria-label="Footer links"');
  });

  it("re-exports main id constant for skip-link alignment", () => {
    expect(MAIN_CONTENT_ID.length).toBeGreaterThan(4);
  });
});
