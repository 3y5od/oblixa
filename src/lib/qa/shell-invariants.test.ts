import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("shell invariants", () => {
  it("dashboard layout uses the shared main content id", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(raw).toContain("MAIN_CONTENT_ID");
    expect(raw).toContain("id={MAIN_CONTENT_ID}");
  });

  it("keeps dashboard scrolling document-based so zoomed layouts can reach the footer", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(raw).toContain("flex min-h-dvh");
    expect(raw).toContain('data-app-content className="flex min-h-dvh');
    expect(raw).not.toContain("h-dvh max-h-dvh min-h-0");
    expect(raw).not.toContain("overflow-hidden bg-transparent");
    expect(raw).not.toContain("overflow-y-auto overscroll-y-contain px-4");
  });

  it("keeps the desktop sidebar viewport-bounded with an independently scrollable nav body", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/layout/sidebar.tsx"), "utf8");
    expect(raw).toContain("sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col");
    expect(raw).toContain('const bodyClassName = "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3"');
    expect(raw).not.toContain("min-h-0 shrink-0 overflow-y-auto overscroll-y-contain px-2.5 py-3");
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

