import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §16 CmdK + search jumps", () => {
  it("command palette stays a keyboard-first client surface with CmdK jump wiring", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/layout/command-palette.tsx"),
      "utf8"
    );
    expect(raw).toContain("export function CommandPalette");
    expect(raw).toContain('aria-label="Command palette"');
    expect(raw).toContain("getCmdkSearchJumpItems");
    expect(raw.length).toBeGreaterThan(200);
  });

  it("cmdk search jumps export stable contract destinations", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/product-surface/cmdk-search-jumps.ts"), "utf8");
    expect(raw).toContain("contracts");
    expect(raw).toContain("getCmdkSearchJumpItems");
  });
});
