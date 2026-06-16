import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatBusinessDateAtNoon, parseBusinessDateAtNoon } from "@/lib/business-dates";
import { installFrozenTime } from "@/test-utils/deterministic-time";

const DATE_DISPLAY_SURFACES = [
  "src/components/dashboard/upcoming-actions.tsx",
  "src/components/dashboard/my-tasks.tsx",
  "src/components/dashboard/my-obligations.tsx",
  "src/components/contracts/contract-task-summary.tsx",
  "src/components/contracts/contract-obligations-row.tsx",
  "src/components/contracts/renewal-checkpoints-panel.tsx",
  "src/components/contracts/field-review-row.tsx",
  "src/lib/renewals/model.ts",
  "src/app/(dashboard)/contracts/[id]/page.tsx",
  "src/app/(dashboard)/contracts/tasks/tasks-ledger.tsx",
  "src/app/(dashboard)/contracts/obligations/obligations-ledger.tsx",
] as const;

const DATE_ONLY_CALCULATION_SURFACES = [
  "src/actions/contracts-lifecycle.ts",
  "src/actions/obligations.ts",
  "src/actions/renewal-playbook.ts",
  "src/actions/tasks.ts",
  "src/app/(dashboard)/contracts/tasks/page.tsx",
  "src/app/(dashboard)/contracts/obligations/page.tsx",
  "src/app/(dashboard)/contracts/analytics/page.tsx",
  "src/app/api/reports/capture-metrics/route.ts",
  "src/lib/workflow/primitives.ts",
] as const;

function readSurface(file: string): string {
  if (file === "src/app/(dashboard)/contracts/[id]/page.tsx") {
    const detailDir = join(process.cwd(), "src/app/(dashboard)/contracts/[id]");
    return readdirSync(detailDir)
      .filter((entry) => entry === "page.tsx" || /^contract-detail.*\.(ts|tsx)$/.test(entry))
      .sort()
      .map((entry) => readFileSync(join(detailDir, entry), "utf8"))
      .join("\n");
  }
  return readFileSync(join(process.cwd(), file), "utf8");
}

describe("V9 timezone date format sweep", () => {
  installFrozenTime("2026-03-08T06:59:59.000Z");

  it("formats stable business dates via the noon-normalized helper", () => {
    expect(formatBusinessDateAtNoon("2026-04-18")).toBe("Apr 18, 2026");
    expect(formatBusinessDateAtNoon("2026-04-18T00:00:00Z")).toBe("Apr 18, 2026");
    expect(formatBusinessDateAtNoon(null)).toBe("—");
  });

  it("keeps date-only boundaries stable with a pinned clock", () => {
    expect(new Date().toISOString()).toBe("2026-03-08T06:59:59.000Z");
    expect(formatBusinessDateAtNoon("2024-02-29")).toBe("Feb 29, 2024");
    expect(formatBusinessDateAtNoon("2026-03-08")).toBe("Mar 8, 2026");
    expect(formatBusinessDateAtNoon("2026-11-01")).toBe("Nov 1, 2026");
    expect(formatBusinessDateAtNoon("2026-12-31T23:59:59Z")).toBe("Dec 31, 2026");
    expect(parseBusinessDateAtNoon("not-a-date")).toBeNull();
  });

  it("reuses the shared helper across core list/detail/dashboard surfaces", () => {
    for (const file of DATE_DISPLAY_SURFACES) {
      const raw = readSurface(file);
      expect(raw, file).toContain("formatBusinessDateAtNoon");
    }
  });

  it("normalizes contract list horizon calculations with parseBusinessDateAtNoon", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/contract-list-row-signals.ts"), "utf8");
    expect(raw).toContain("parseBusinessDateAtNoon");
  });

  it("keeps date-only calculations on the shared parser", () => {
    for (const file of DATE_ONLY_CALCULATION_SURFACES) {
      const raw = readFileSync(join(process.cwd(), file), "utf8");
      expect(raw, file).toContain("parseBusinessDateAtNoon");
    }
  });

  it("does not reintroduce inline noon parsing in date-only surfaces", () => {
    for (const file of new Set([...DATE_DISPLAY_SURFACES, ...DATE_ONLY_CALCULATION_SURFACES])) {
      const raw = readSurface(file);
      expect(raw, file).not.toContain("T12:00:00");
    }
    expect(readFileSync(join(process.cwd(), "src/lib/business-dates.ts"), "utf8")).toContain("T12:00:00");
  });
});
