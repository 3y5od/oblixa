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

const EMPTY_STATE_SURFACE_EXTRAS: Record<string, string[]> = {
  "src/app/(dashboard)/contracts/renewals/page.tsx": [
    "src/app/(dashboard)/contracts/renewals/renewals-page-view.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-page-sections.tsx",
  ],
  "src/app/(dashboard)/contracts/approvals/page.tsx": [
    "src/app/(dashboard)/contracts/approvals/approvals-queue.tsx",
  ],
  "src/app/(dashboard)/contracts/tasks/page.tsx": [
    "src/app/(dashboard)/contracts/tasks/tasks-ledger.tsx",
  ],
  "src/app/(dashboard)/contracts/obligations/page.tsx": [
    "src/app/(dashboard)/contracts/obligations/obligations-ledger.tsx",
  ],
  "src/app/(dashboard)/contracts/exceptions/page.tsx": [
    "src/app/(dashboard)/contracts/exceptions/exceptions-page-view.tsx",
  ],
};

function readEmptyStateSurface(rel: string): string {
  return [rel, ...(EMPTY_STATE_SURFACE_EXTRAS[rel] ?? [])]
    .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
    .join("\n");
}

describe("V9 §20 empty states — high-traffic Core surfaces", () => {
  it.each(CORE_EMPTY_PAGES)("%s imports the shared EmptyState primitive", (rel) => {
    const raw = readEmptyStateSurface(rel);
    const usesLegacyEmptyState = raw.includes('from "@/components/ui/empty-state"') && raw.includes("<EmptyState");
    const usesRecoverableState =
      raw.includes('from "@/components/ui/recoverable-state"') && raw.includes("<RecoverableState");
    expect(usesLegacyEmptyState || usesRecoverableState).toBe(true);
  });

  it("keeps the EmptyState API to a single optional action slot (§20.2 CTA budget)", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/ui/empty-state.tsx"), "utf8");
    expect(raw).toContain("action?: ReactNode");
    expect(raw).not.toMatch(/secondaryAction|tertiaryAction/i);
  });
});
