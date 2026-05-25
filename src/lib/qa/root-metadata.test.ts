import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("root layout metadata (V7 §AO social)", () => {
  it("keeps default title and description neutral (no Advanced/Assurance product framing)", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const lower = raw.toLowerCase();
    expect(raw).toContain("Oblixa");
    expect(lower).not.toContain("decisions workspace");
    expect(lower).not.toContain("assurance mode");
    expect(lower).not.toContain("campaign operations");
  });
});
