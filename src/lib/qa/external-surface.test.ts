import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("external participant surface (V7 boundary)", () => {
  it("keeps token page free of dashboard nav / primary shell imports", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/external/[token]/page.tsx"),
      "utf8"
    );
    expect(raw).not.toContain("NAV_ITEMS");
    expect(raw).not.toContain("sidebar");
    expect(raw).not.toContain("command-palette");
    expect(raw).toContain("ExternalSubmitForm");
  });
});
