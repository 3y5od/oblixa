import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Core queues that should use the shared EmptyState primitive (V9 §20.1–20.2). */
const CORE_EMPTY_PAGES = [
  "src/app/(dashboard)/work/page.tsx",
  "src/app/(dashboard)/contracts/renewals/page.tsx",
  "src/app/(dashboard)/contracts/approvals/page.tsx",
  "src/app/(dashboard)/contracts/obligations/page.tsx",
  "src/app/(dashboard)/contracts/tasks/page.tsx",
  "src/app/(dashboard)/contracts/review/page.tsx",
  "src/app/(dashboard)/contracts/exceptions/page.tsx",
  "src/app/(dashboard)/contracts/evidence-studio/page.tsx",
];

describe("V9 §20 empty states — high-traffic Core surfaces", () => {
  it.each(CORE_EMPTY_PAGES)("%s imports the shared EmptyState primitive", (rel) => {
    const raw = readFileSync(join(process.cwd(), rel), "utf8");
    const usesLegacyEmptyState = raw.includes('from "@/components/ui/empty-state"') && raw.includes("<EmptyState");
    const usesV10RecoverableState =
      raw.includes('from "@/components/ui/v10-recoverable-state"') && raw.includes("<V10RecoverableState");
    expect(usesLegacyEmptyState || usesV10RecoverableState).toBe(true);
  });

  it("keeps the EmptyState API to a single optional action slot (§20.2 CTA budget)", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/ui/empty-state.tsx"), "utf8");
    expect(raw).toContain("action?: ReactNode");
    expect(raw).not.toMatch(/secondaryAction|tertiaryAction/i);
  });
});
