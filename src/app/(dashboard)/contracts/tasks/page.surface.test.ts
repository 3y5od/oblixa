import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/tasks/page.tsx");

describe("contracts tasks page surface", () => {
  it("constrains the nested page stack on narrow viewports", () => {
    const raw = readFileSync(PAGE, "utf8");

    expect(raw).toContain('className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl"');
  });
});
