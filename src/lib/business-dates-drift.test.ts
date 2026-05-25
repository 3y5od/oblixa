import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DUE_SOON_DAYS } from "./business-dates";

/**
 * §23 / business dates — forbid duplicate “due soon” horizons outside the shared constant.
 */
describe("business dates single source", () => {
  it("dashboard-upper due-soon copy derives from DUE_SOON_DAYS", () => {
    const upper = readFileSync(join(process.cwd(), "src/components/dashboard/dashboard-upper.tsx"), "utf8");
    expect(upper).toContain("DUE_SOON_DAYS");
    expect(upper).toContain("`Items in the next ${DUE_SOON_DAYS} days");
    expect(DUE_SOON_DAYS).toBe(14);
  });

  it("work hub due_soon lens uses the same horizon constant", () => {
    const work = [
      readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/app/(dashboard)/work/work-page-helpers.ts"), "utf8"),
    ].join("\n");
    expect(work).toContain("DUE_SOON_DAYS");
  });

  it("dashboard operational signals use DUE_SOON_DAYS for due-soon counts", () => {
    const data = readFileSync(join(process.cwd(), "src/lib/dashboard-data.ts"), "utf8");
    expect(data).toContain("DUE_SOON_DAYS");
  });
});
