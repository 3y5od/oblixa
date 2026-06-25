import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/evidence-studio/page.tsx");
const TABLE = join(process.cwd(), "src/app/(dashboard)/contracts/evidence-studio/evidence-table.tsx");
const FILTER_BAR = join(process.cwd(), "src/components/evidence/evidence-filter-bar.tsx");

describe("contracts evidence studio surface", () => {
  it("constrains evidence filters and mobile cards on narrow viewports", () => {
    const page = [PAGE, TABLE].map((file) => readFileSync(file, "utf8")).join("\n");
    const filterBar = readFileSync(FILTER_BAR, "utf8");

    expect(page).toContain('className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl"');
    expect(page).toContain('className="ui-card min-w-0 max-w-full scroll-mt-8 overflow-x-hidden p-0"');
    expect(page).toContain('className="min-w-0 max-w-full border-t');
    expect(page).toContain('className="min-w-0 divide-y');
    expect(filterBar).toContain('className="min-w-0 max-w-full space-y-3');
    // The filter row is the shared FilterBar/FilterSelect (one recipe with Work,
    // Renewals, Reports).
    expect(filterBar).toContain("FilterBar");
    expect(filterBar).toContain("FilterSelect");
    expect(filterBar).toContain('className="group relative inline-flex max-w-full');
    // Condition definitions ride on each quick-filter chip's hover tooltip + aria
    // (the prose definition wall is retired, matching Contracts).
    expect(filterBar).toContain("The request is due within the next 7 days.");
    expect(filterBar).toContain("No evidence file is attached, so the request can't be accepted yet.");
  });
});
