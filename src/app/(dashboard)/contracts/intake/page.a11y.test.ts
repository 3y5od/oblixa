import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/intake/page.tsx");

describe("contracts intake page accessibility", () => {
  it("keeps repeated row intake controls named", () => {
    const raw = readFileSync(PAGE, "utf8");

    // Status control is now a custom combobox (UiSelect) — its accessible name
    // comes from the `ariaLabel` prop (rendered to aria-label on the trigger).
    expect(raw).toContain('ariaLabel={`Intake status for ${String(row.title ?? "contract")}`}');
    expect(raw).toContain('aria-label={`Completeness score for ${String(row.title ?? "contract")}`}');
  });
});
