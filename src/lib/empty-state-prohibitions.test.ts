import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §20.3 empty-state copy prohibitions (Core primitive)", () => {
  it("avoids vague dead-end phrases in the shared EmptyState component", () => {
    const body = readFileSync(join(process.cwd(), "src/components/ui/empty-state.tsx"), "utf8").toLowerCase();
    expect(body).not.toContain("something went wrong");
    expect(body).not.toContain("no data");
  });
});
