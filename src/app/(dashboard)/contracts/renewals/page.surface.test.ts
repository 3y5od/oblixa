import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx");
const PAGE_VIEW = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewals-page-view.tsx");
const LEDGER = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewals-ledger.tsx");
const LEDGER_CONSTANTS = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewals-ledger-constants.ts");
const ROW_CELLS = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewal-row-cells.tsx");
const ROW_DETAIL = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewal-row-detail.tsx");
const ACTION_CLUSTER = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewal-action-cluster.tsx");
const PAGE_SECTIONS = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewals-page-sections.tsx");
const FILTER_BAR = join(process.cwd(), "src/components/renewals/renewal-filter-bar.tsx");
const SHARED_FILTER_BAR = join(process.cwd(), "src/components/ui/filter-bar.tsx");

function readRenewalsSurface(): string {
  return [
    PAGE,
    PAGE_VIEW,
    LEDGER,
    LEDGER_CONSTANTS,
    ROW_CELLS,
    ROW_DETAIL,
    ACTION_CLUSTER,
    PAGE_SECTIONS,
  ]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

describe("contracts renewals page surface", () => {
  it("rides the shared data-surface shell + card so it shares the Core ledger recipe", () => {
    const raw = readRenewalsSurface();

    // The page no longer hand-rolls its page-stack width / card chrome; it uses
    // the shared DataSurfaceShell (medium → max-w-7xl) + DataSurfaceCard so it
    // shares one width, radius, border, and clipping recipe with the other dense
    // Core ledgers (Contracts, Work, Evidence, Reports).
    expect(raw).toContain("DataSurfaceShell");
    expect(raw).toContain('width="medium"');
    expect(raw).toContain("DataSurfaceCard");
  });

  it("constrains renewal row surfaces on narrow viewports and keeps the band vocabulary", () => {
    const raw = readRenewalsSurface();

    // The bounded, horizontally-scrollable rows region is the narrow-viewport
    // guard: long ledger rows scroll within the card rather than forcing the
    // whole page wide.
    expect(raw).toContain(
      'className="max-h-[60vh] max-w-full overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]"'
    );
    // The condition vocabulary now rides on each chip's hover/aria definition
    // (the labeled wall is retired).
    expect(raw).toContain("Renewal and notice deadlines inside the selected window.");
    expect(raw).toMatch(/renewal or notice date\s+is missing, suggested, or calculated and still needs confirmation/);
  });

  it("renders the expandable ledger row with an operational consequence line", () => {
    const raw = readRenewalsSurface();

    // Rows are expandable disclosures (§31) and carry the plain-language
    // operational consequence (§14) plus the shared provenance badge (§17/§62).
    expect(raw).toContain("RenewalRowDisclosure");
    expect(raw).toContain("row.consequence.label");
    expect(raw).toContain("DateProvenanceBadge");
    // Counts state their object type via the shared OperationalCount (§19/§64).
    expect(raw).toContain("OperationalCount");
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
    // The due-window keeps an explicit caps label (the two-token pill shows it
    // beside the value); shortened to "Due".
    expect(bar).toContain('label="Due"');
    // Every control is a real custom combobox — never a native <select> (§7.3 / §11.1).
    expect(bar).not.toMatch(/<select[\s>]/);

    // The toolbar band + min-w-0 overflow guard now live in the shared component.
    expect(shared).toContain("ui-filter-toolbar");
    expect(shared).toContain("min-w-0");
    expect(shared).not.toMatch(/<select[\s>]/);
  });
});
