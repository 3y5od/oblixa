import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = join(process.cwd(), "src/components/ui/ui-tabs.tsx");

describe("UiTabs surface", () => {
  it("keeps horizontal tab scrolling contained to the tab rail", () => {
    const raw = readFileSync(SOURCE, "utf8");

    expect(raw).toContain("max-w-full");
    expect(raw).toContain("[contain:inline-size]");
    expect(raw).toContain("overflow-x-auto");
  });
});
