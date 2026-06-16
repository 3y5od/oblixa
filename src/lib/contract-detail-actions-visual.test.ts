import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contract detail action controls", () => {
  it("keeps extracted-field actions visibly bordered and comfortably spaced", () => {
    const detailDir = join(process.cwd(), "src/app/(dashboard)/contracts/[id]");
    const page = readdirSync(detailDir)
      .filter((file) => file === "page.tsx" || /^contract-detail.*\.(ts|tsx)$/.test(file))
      .sort()
      .map((file) => readFileSync(join(detailDir, file), "utf8"))
      .join("\n");
    const extractButton = readFileSync(join(process.cwd(), "src/components/contracts/extract-button.tsx"), "utf8");

    expect(page).toContain('href="/contracts/review"');
    expect(page).toContain("ui-btn-secondary w-full whitespace-nowrap");
    expect(extractButton).toContain("ui-btn-primary w-full whitespace-nowrap px-4 py-2 text-sm");
    expect(extractButton).toContain("sm:px-5");
  });
});
