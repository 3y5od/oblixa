import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/evidence-studio/page.tsx");
const FILTER_BAR = join(process.cwd(), "src/components/evidence/evidence-filter-bar.tsx");

describe("contracts evidence studio surface", () => {
  it("constrains evidence filters and mobile cards on narrow viewports", () => {
    const page = readFileSync(PAGE, "utf8");
    const filterBar = readFileSync(FILTER_BAR, "utf8");

    expect(page).toContain('className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl"');
    expect(page).toContain('className="ui-card min-w-0 max-w-full scroll-mt-8 overflow-x-hidden p-0"');
    expect(page).toContain('className="min-w-0 max-w-full border-t');
    expect(page).toContain('className="min-w-0 divide-y');
    expect(filterBar).toContain('className="min-w-0 max-w-full space-y-3');
    // The filter row is now the shared FilterBar/FilterSelect (de-formed from the
    // old 6-col label grid), so it shares one recipe with Work, Renewals, Reports.
    expect(filterBar).toContain("FilterBar");
    expect(filterBar).toContain("FilterSelect");
    expect(filterBar).toContain('className="group inline-flex max-w-full');
  });
});
