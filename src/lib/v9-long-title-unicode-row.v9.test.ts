import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("§9.2 + §26.2 long titles and bidi row containment", () => {
  it("keeps contract title links truncated with isolate bidi + min-width discipline", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/contracts/contract-table.tsx"),
      "utf8"
    );
    expect(raw).toContain("truncate");
    expect(raw).toContain("min-w-0");
    expect(raw).toContain("unicode-bidi:isolate");
    expect(raw).toContain('dir="auto"');
  });
});
