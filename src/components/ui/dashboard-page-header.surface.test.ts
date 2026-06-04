import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = join(process.cwd(), "src/components/ui/dashboard-page-header.tsx");

describe("DashboardPageHeader surface", () => {
  it("keeps the meta/action cluster constrained on narrow viewports", () => {
    const raw = readFileSync(SOURCE, "utf8");

    expect(raw).toContain("flex min-w-0 max-w-full flex-wrap justify-start");
    expect(raw).toContain("sm:justify-end");
    expect(raw).toContain("flex min-w-0 max-w-full flex-wrap items-center gap-x-5");
    expect(raw).toContain("flex min-w-0 max-w-full flex-wrap items-center gap-2");
  });
});
