import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx");
const TABLE = join(process.cwd(), "src/components/contracts/contract-table.tsx");

describe("contracts page surface", () => {
  it("constrains the contracts page stack and table shell on narrow viewports", () => {
    const page = readFileSync(PAGE, "utf8");
    const table = readFileSync(TABLE, "utf8");

    // Canonical wide width + one integrated surface, via the shared shell.
    expect(page).toContain("<DataSurfaceShell");
    expect(page).toContain('width="wide"');
    expect(page).toContain("<DataSurfaceCard");
    // The table renders bare inside that card (it no longer carries its own
    // .ui-table-shell — that would be card-within-card), keeping the min-w-0 /
    // max-w-full and contained horizontal-scroll guards that prevent
    // narrow-viewport overflow.
    expect(table).toContain('className="min-w-0 max-w-full"');
    expect(table).toContain('className="max-w-full overflow-x-auto [contain:inline-size]"');
    expect(table).toContain("const [isNarrow, setIsNarrow] = useState(true)");
    expect(table).toContain("const selectionCellClass");
    expect(table).toContain("pl-4 pr-2");
    expect(page).toContain("Contract shortcuts");
    expect(page).toContain("Each count is a contract count. Selecting a shortcut filters the table to contracts with that condition.");
    expect(page).toContain("required renewal, notice, end, or effective dates are absent");
    expect(page).toContain('href="/contracts?review=pending"');
  });
});
