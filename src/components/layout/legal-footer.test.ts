import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("LegalFooter (V7 §AO)", () => {
  it("does not link to Advanced or Assurance dashboard hubs", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/layout/legal-footer.tsx"), "utf8");
    expect(raw).not.toContain('href="/decisions');
    expect(raw).not.toContain('href="/campaigns');
    expect(raw).not.toContain('href="/assurance');
  });
});
