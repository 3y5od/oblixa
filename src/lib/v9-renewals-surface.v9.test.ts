import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §13 renewals — list surface + next action + row actions", () => {
  it("renewals page composes operational summary, saved views, and row checklist actions", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
      "utf8"
    );
    expect(raw).toContain("OperationalSummaryCard");
    expect(raw).toContain("Horizon queue");
    expect(raw).toContain("Saved renewal views");
    expect(raw).toContain("Renewal ledger");
    expect(raw).toContain("RenewalRowChecklistActions");
    expect(raw).toContain("compareRenewalQueueRows");
    expect(raw).toContain("STATUS_LABELS");
    expect(raw).toContain("EVIDENCE_GAP_STATUSES");
  });

  it("shared renewal next-action helper stays anchored for ordering copy", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/renewal-next-action.ts"), "utf8");
    expect(raw).toContain("compareRenewalQueueRows");
    expect(raw.length).toBeGreaterThan(80);
  });
});
