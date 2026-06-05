import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx");
const FILTER_BAR = join(process.cwd(), "src/components/renewals/renewal-filter-bar.tsx");
const SHARED_FILTER_BAR = join(process.cwd(), "src/components/ui/filter-bar.tsx");

describe("contracts renewals page surface", () => {
  it("constrains renewal row surfaces on narrow viewports", () => {
    const raw = readFileSync(PAGE, "utf8");

    expect(raw).toContain('className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl"');
    expect(raw).toContain('className="ui-card min-w-0 max-w-full overflow-hidden"');
    expect(raw).toContain(
      'className="max-h-[60vh] max-w-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"'
    );
  });

  it("renders the due-window + attribute filters as one shared custom combobox toolbar", () => {
    const bar = readFileSync(FILTER_BAR, "utf8");
    const shared = readFileSync(SHARED_FILTER_BAR, "utf8");

    // The bar is composed from the shared FilterBar/FilterSelect primitives, so it
    // can never drift from the other three filter bars (§7.3).
    expect(bar).toContain("FilterBar");
    expect(bar).toContain("FilterSelect");
    // It still opens the card chrome with the bordered toolbar band.
    expect(bar).toContain("border-t");
    // "Due within" keeps its explicit caps label (its value doesn't self-identify).
    expect(bar).toContain('label="Due within"');
    // Every control is a real custom combobox — never a native <select> (§7.3 / §11.1).
    expect(bar).not.toMatch(/<select[\s>]/);

    // The toolbar band + min-w-0 overflow guard now live in the shared component.
    expect(shared).toContain("ui-filter-toolbar");
    expect(shared).toContain("min-w-0");
    expect(shared).not.toMatch(/<select[\s>]/);
  });
});
