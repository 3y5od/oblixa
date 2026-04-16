import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("cross-surface href audit roots (§5.6, §16)", () => {
  it("scans dashboard app routes and shared components", () => {
    const auditPath = join(process.cwd(), "scripts", "audit-v7-cross-surface-hrefs.mjs");
    const src = readFileSync(auditPath, "utf8");
    expect(src).toContain('join(ROOT, "src", "app", "(dashboard)")');
    expect(src).toContain('join(ROOT, "src", "components")');
    expect(src).toContain('join(ROOT, "src", "lib")');
  });
});
