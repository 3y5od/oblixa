import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/obligations/page.tsx");

describe("contracts obligations page surface", () => {
  it("constrains the page stack and ledger scroller on narrow viewports", () => {
    const raw = readFileSync(PAGE, "utf8");

    expect(raw).toContain('className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl"');
    expect(raw).toContain('className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"');
    expect(raw).toContain('className="ui-card min-w-0 max-w-full overflow-hidden p-0"');
    expect(raw).toContain('className="max-w-full overflow-x-auto [contain:inline-size]"');
  });
});
