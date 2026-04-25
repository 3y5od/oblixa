import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY } from "@/lib/reminder-delivery-visibility";

describe("§27.2 reminder inactive (missing approved dates) copy", () => {
  it("uses docs-aligned vocabulary for the shared constant", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
    expect(doc.toLowerCase()).toContain("reminder inactive due to missing approved dates");
    expect(REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY.toLowerCase()).toContain(
      "reminder inactive due to missing approved dates"
    );
  });

  it("is anchored on contract detail operations strip", () => {
    const helper = readFileSync(join(process.cwd(), "src/lib/contract-detail-summary.ts"), "utf8");
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/[id]/page.tsx"),
      "utf8"
    );
    expect(helper).toContain("REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY");
    expect(helper).toContain("/settings/health");
    expect(page).toContain("buildContractOperationsStrip");
  });
});
