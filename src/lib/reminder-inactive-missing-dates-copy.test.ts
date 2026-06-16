import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY } from "@/lib/reminder-delivery-visibility";

describe("§27.2 reminder inactive (missing approved dates) copy", () => {
  it("uses the shared vocabulary for the copy constant", () => {
    expect(REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY.toLowerCase()).toContain(
      "reminder inactive due to missing approved dates"
    );
  });

  it("is anchored on contract detail operations strip", () => {
    const helper = readFileSync(join(process.cwd(), "src/lib/contract-detail-summary.ts"), "utf8");
    const detailSurface = [
      "src/app/(dashboard)/contracts/[id]/page.tsx",
      "src/app/(dashboard)/contracts/[id]/contract-detail-page-model.ts",
    ]
      .map((rel) => readFileSync(join(process.cwd(), rel), "utf8"))
      .join("\n");
    expect(helper).toContain("REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY");
    expect(helper).toContain("/settings/health");
    expect(detailSurface).toContain("buildContractOperationsStrip");
  });
});
