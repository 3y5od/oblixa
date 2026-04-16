import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("shell invariants", () => {
  it("dashboard layout uses the shared main content id", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(raw).toContain("MAIN_CONTENT_ID");
    expect(raw).toContain("id={MAIN_CONTENT_ID}");
  });

  it("skip link targets the shared main content id", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/layout/skip-link.tsx"), "utf8");
    expect(raw).toContain("MAIN_CONTENT_ID");
  });

  it("header, sidebar, and command palette consume shared selector constants", () => {
    const files = [
      "src/components/layout/header.tsx",
      "src/components/layout/sidebar.tsx",
      "src/components/layout/command-palette.tsx",
    ] as const;
    for (const rel of files) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw, rel).toContain("test-ids");
    }
  });
});

