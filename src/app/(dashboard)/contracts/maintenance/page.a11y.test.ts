import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/maintenance/page.tsx");

describe("contracts maintenance page accessibility", () => {
  it("keeps native maintenance form controls named", () => {
    const raw = readFileSync(PAGE, "utf8");

    // Native text inputs/textareas keep their HTML aria-label.
    for (const label of ["Seed contract IDs", "Change summary"]) {
      expect(raw).toContain(`aria-label="${label}"`);
    }
    // Selects are now custom comboboxes (UiSelect) — named via the ariaLabel prop
    // (which renders to aria-label on the trigger at runtime).
    for (const label of [
      "Campaign type",
      "Correction campaign type",
      "Date field to backfill",
      "Change event type",
      "Change impact level",
    ]) {
      expect(raw).toContain(`ariaLabel="${label}"`);
    }

    expect(raw).toContain("ariaLabel={`Owner for ${row.title}`}");
  });
});
