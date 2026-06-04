import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx");
const FILTER_BAR = join(process.cwd(), "src/components/renewals/renewal-filter-bar.tsx");

describe("contracts renewals page surface", () => {
  it("constrains renewal row surfaces on narrow viewports", () => {
    const raw = readFileSync(PAGE, "utf8");

    expect(raw).toContain('className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl"');
    expect(raw).toContain('className="ui-card min-w-0 max-w-full overflow-hidden"');
    expect(raw).toContain(
      'className="max-h-[60vh] max-w-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"'
    );
  });

  it("renders the due-window + attribute filters as one width-stable custom combobox toolbar", () => {
    const bar = readFileSync(FILTER_BAR, "utf8");

    // The filter row is the bordered toolbar band that opens the card chrome, kept
    // min-w-0 so it never forces horizontal overflow on a narrow viewport.
    expect(bar).toContain('className="ui-filter-toolbar min-w-0 border-t');
    // Each control sits in a fixed-width, non-shrinking slot so the row reads as an
    // aligned band and does not reflow as values change (§7.3).
    expect(bar).toContain("min-w-0 shrink-0");
    // "Due within" and every attribute filter are real custom comboboxes — a
    // UiSelect with a trigger / chevron / value — never a native <select> (§7.3 / §11.1).
    expect(bar).toContain("UiSelect");
    expect(bar).toContain('label="Due within"');
    expect(bar).not.toMatch(/<select[\s>]/);
  });
});
