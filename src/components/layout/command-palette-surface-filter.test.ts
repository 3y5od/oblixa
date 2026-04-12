import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMMAND_PALETTE = join(process.cwd(), "src/components/layout/command-palette.tsx");

describe("command palette search-scope surface filtering", () => {
  it("uses isCmdkHrefAllowed for static and recent item filtering", () => {
    const raw = readFileSync(COMMAND_PALETTE, "utf8");
    expect(raw.includes("isCmdkHrefAllowed")).toBe(true);
    expect(raw.includes("isCmdkHrefAllowed(item.href, surface)")).toBe(true);
    expect(raw.includes("isCmdkHrefAllowed(match.href, surface)")).toBe(true);
  });

  it("listens for header search bridge event", () => {
    const raw = readFileSync(COMMAND_PALETTE, "utf8");
    expect(raw.includes("COMMAND_PALETTE_OPEN_EVENT")).toBe(true);
    expect(raw.includes("addEventListener(COMMAND_PALETTE_OPEN_EVENT")).toBe(true);
  });
});
