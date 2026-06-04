import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/work/page.tsx");

describe("work page surface", () => {
  it("constrains the nested page stack on narrow viewports", () => {
    const raw = readFileSync(PAGE, "utf8");

    expect(raw).toContain(
      'className="ui-page-stack mx-auto w-full min-w-0 max-w-[1600px] overflow-x-clip"'
    );
    expect(raw).toContain(
      'className="ui-table-shell min-w-0 max-w-full [contain:inline-size]"'
    );
    expect(raw).toContain(
      'className="hidden max-h-[calc(100dvh-20rem)] min-w-0 max-w-full overflow-x-auto overflow-y-auto [contain:inline-size] md:block"'
    );
  });
});
