import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("layout boundary consistency", () => {
  it("marketing layout stays isolated from authenticated shell wiring", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(marketing)/layout.tsx"), "utf8");
    expect(raw).not.toContain("Sidebar");
    expect(raw).not.toContain("CommandPalette");
  });

  it("auth layout stays isolated from dashboard navigation wiring", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(auth)/layout.tsx"), "utf8");
    expect(raw).not.toContain("Sidebar");
    expect(raw).not.toContain("CommandPalette");
  });

  it("external layout stays isolated from dashboard shell components", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/external/layout.tsx"), "utf8");
    expect(raw).not.toContain("Sidebar");
    expect(raw).not.toContain("Header");
  });
});

