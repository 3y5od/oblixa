import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATUS_LABELS } from "./contracts";

/**
 * §24.3 — contract lifecycle status strings stay wired through the shared STATUS_LABELS map
 * into the primary list surface (prevents list vs detail drift for the same enum).
 */
describe("V9 cross-surface contract status labels", () => {
  it("contract table resolves chip text through STATUS_LABELS (single map)", () => {
    const table = [
      "src/components/contracts/contract-table-desktop.tsx",
      "src/components/contracts/contract-table-mobile.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    expect(table).toContain("STATUS_LABELS[contract.status]");
    expect(Object.keys(STATUS_LABELS).length).toBeGreaterThanOrEqual(4);
  });

  it("renewals workspace uses its dedicated renewal status-label map", () => {
    const renewalsModel = readFileSync(join(process.cwd(), "src/lib/renewals/model.ts"), "utf8");
    expect(renewalsModel).toContain("RENEWAL_STATUS_LABELS[status]");
  });

  it("watchlists and contracts filters reuse the same contract status labels", () => {
    const watchlists = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/watchlists/page.tsx"),
      "utf8"
    );
    const contractsPage = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/contracts-page-model.ts"), "utf8");
    expect(watchlists).toContain("STATUS_LABELS");
    expect(contractsPage).toContain("STATUS_LABELS");
  });
});
