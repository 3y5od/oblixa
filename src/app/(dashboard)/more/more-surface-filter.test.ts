import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MORE_PAGE = join(process.cwd(), "src/app/(dashboard)/more/page.tsx");

describe("more page surface filtering", () => {
  it("applies cmd-k eligibility and core_only route-floor filtering", () => {
    const raw = readFileSync(MORE_PAGE, "utf8");
    expect(raw.includes("isCmdkHrefAllowed")).toBe(true);
    expect(raw.includes("navInput.searchScope !== \"core_only\"")).toBe(true);
    expect(raw.includes("minWorkspaceModeForPath(path) === \"core\"")).toBe(true);
  });
});
