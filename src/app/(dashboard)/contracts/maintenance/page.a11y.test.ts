import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/maintenance/page.tsx");

describe("contracts maintenance page accessibility", () => {
  it("keeps native maintenance form controls named", () => {
    const raw = readFileSync(PAGE, "utf8");

    for (const label of [
      "Campaign type",
      "Seed contract IDs",
      "Correction campaign type",
      "Date field to backfill",
      "Change event type",
      "Change impact level",
      "Change summary",
    ]) {
      expect(raw).toContain(`aria-label="${label}"`);
    }

    expect(raw).toContain("aria-label={`Owner for ${row.title}`}");
  });
});
