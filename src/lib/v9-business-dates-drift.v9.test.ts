import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_DUE_SOON_DAYS } from "./v9-business-dates";

/**
 * §23 / business dates — forbid duplicate “due soon” horizons outside the shared constant.
 */
describe("V9 business dates single source", () => {
  it("dashboard-upper due-soon copy derives from V9_DUE_SOON_DAYS", () => {
    const upper = readFileSync(join(process.cwd(), "src/components/dashboard/dashboard-upper.tsx"), "utf8");
    expect(upper).toContain("V9_DUE_SOON_DAYS");
    expect(upper).toContain("`Items in the next ${V9_DUE_SOON_DAYS} days");
    expect(V9_DUE_SOON_DAYS).toBe(14);
  });

  it("work hub due_soon lens uses the same horizon constant", () => {
    const work = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(work).toContain("V9_DUE_SOON_DAYS");
  });

  it("dashboard operational signals use V9_DUE_SOON_DAYS for due-soon counts", () => {
    const data = readFileSync(join(process.cwd(), "src/lib/dashboard-data.ts"), "utf8");
    expect(data).toContain("V9_DUE_SOON_DAYS");
  });
});
