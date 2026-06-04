import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LAYOUT = join(process.cwd(), "src/app/(dashboard)/layout.tsx");

describe("dashboard layout surface", () => {
  it("constrains the shared content stack on narrow viewports", () => {
    const raw = readFileSync(LAYOUT, "utf8");

    expect(raw).toContain(
      'className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip bg-transparent"'
    );
    expect(raw).toContain(
      'className="flex-1 overflow-x-clip px-4 py-5 outline-none md:px-6 md:py-6 xl:px-8"'
    );
    expect(raw).toContain(
      'className="ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip pb-2"'
    );
  });
});
