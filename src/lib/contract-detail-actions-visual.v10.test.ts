import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contract detail action controls", () => {
  it("keeps extracted-field actions visibly bordered and comfortably spaced", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/[id]/page.tsx"), "utf8");
    const extractButton = readFileSync(join(process.cwd(), "src/components/contracts/extract-button.tsx"), "utf8");

    expect(page).toContain('href="/contracts/review" className="ui-btn-secondary');
    expect(extractButton).toContain("ui-btn-primary w-full whitespace-nowrap px-4 py-2 text-sm");
    expect(extractButton).toContain("sm:px-5");
  });
});
