import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MARKETING_LAYOUT = join(process.cwd(), "src/app/(marketing)/layout.tsx");
const EXTERNAL_LAYOUT = join(process.cwd(), "src/app/external/layout.tsx");

describe("external + marketing surface isolation", () => {
  it("keeps marketing layout free of authenticated dashboard nav payload wiring", () => {
    const raw = readFileSync(MARKETING_LAYOUT, "utf8");
    expect(raw.includes("NAV_ITEMS")).toBe(false);
    expect(raw.includes("sidebar")).toBe(false);
    expect(raw.includes("command-palette")).toBe(false);
  });

  it("keeps external token layout isolated from authenticated nav shell", () => {
    const raw = readFileSync(EXTERNAL_LAYOUT, "utf8");
    expect(raw.includes("NAV_ITEMS")).toBe(false);
    expect(raw.includes("Sidebar")).toBe(false);
    expect(raw.includes("Header")).toBe(false);
    expect(raw.includes("AuthLegalFooter")).toBe(true);
  });
});
