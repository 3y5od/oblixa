import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contract inventory uses a real table with release-state columns", () => {
  it("renders a semantic <table> with the spec-prescribed column headers and hover-revealed row actions", () => {
    const src = [
      "src/components/contracts/contract-table.tsx",
      "src/components/contracts/contract-table-desktop.tsx",
      "src/components/contracts/contract-table-mobile.tsx",
      "src/components/contracts/contract-table-chips.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    // Real table semantics — release-state spec calls for table columns.
    expect(src).toContain("<table");
    expect(src).toContain("<thead");
    expect(src).toContain("<tbody");
    expect(src).toContain('aria-label="Contracts in this workspace"');
    expect(src).toContain('aria-label="Select all contracts on this page"');

    // Eight canonical column labels from oblixa-release-state.md §Contracts.
    expect(src).toContain("Contract");
    for (const label of [
      "Counterparty",
      "Owner",
      "Status",
      "Next important date",
      "Review state",
      "Open tasks",
      "Last updated",
    ]) {
      expect(src).toContain(label);
    }

    // The four row actions from oblixa-release-state.md §Contracts. Now
    // bundled into the shared RowActionMenu kebab instead of inline buttons.
    for (const action of [
      "Open contract",
      "Assign owner",
      "Add reminder",
      "Create task",
    ]) {
      expect(src).toContain(action);
    }
    // The kebab is the shared RowActionMenu; its trigger is labeled "Row actions"
    // via triggerLabel (the literal aria-label now lives in the shared component).
    expect(src).toContain('triggerLabel="Row actions"');

    // The card-per-row architecture and its grid-class anchors are gone.
    expect(src).not.toContain("signalGridClass");
    expect(src).not.toContain("signalCellClass");
    expect(src).not.toContain("md:grid-cols-2 xl:grid-cols-4");
    expect(src).not.toContain('role="list"');
    expect(src).not.toContain('role="listitem"');
    // The detached per-row "Open contract" button is gone (defect #10) —
    // the title link is the primary affordance, and the kebab menu carries
    // the same verb for the secondary path. Sanity check: the verb appears
    // in source only inside the kebab menu, not as a standalone ui-btn-*.
    expect(src).not.toMatch(/ui-btn-secondary[^"]*"\s*>\s*Open contract/);
  });

  it("avoids row virtualization libraries so render order matches `contracts.map`", () => {
    const src = readFileSync(join(process.cwd(), "src/components/contracts/contract-table.tsx"), "utf8");
    expect(src).toContain("contracts.map(");
    expect(src).not.toMatch(
      /@tanstack\/react-virtual|react-window|virtua|useVirtual/i
    );
  });
});
