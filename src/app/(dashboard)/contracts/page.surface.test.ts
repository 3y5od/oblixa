import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx");
const TABLE = join(process.cwd(), "src/components/contracts/contract-table.tsx");

describe("contracts page surface", () => {
  it("constrains the contracts page stack and table shell on narrow viewports", () => {
    const page = readFileSync(PAGE, "utf8");
    const table = readFileSync(TABLE, "utf8");

    expect(page).toContain('className="ui-page-stack w-full min-w-0"');
    expect(page).toContain('className="min-w-0 space-y-2"');
    expect(page).toContain('className="min-w-0"');
    expect(table).toContain('className="ui-table-shell min-w-0 max-w-full"');
    expect(table).toContain('className="max-w-full overflow-x-auto [contain:inline-size]"');
    expect(table).toContain("const [isNarrow, setIsNarrow] = useState(true)");
  });
});
