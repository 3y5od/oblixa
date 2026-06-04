import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("early-access pricing contract", () => {
  const raw = readFileSync(join(process.cwd(), "src/app/(marketing)/pricing/page.tsx"), "utf8");
  const jsonLdRaw = readFileSync(
    join(process.cwd(), "src/components/landing/landing-json-ld.tsx"),
    "utf8"
  );

  it("presents pricing as evaluation-first, not a fixed public plan matrix", () => {
    expect(raw).toContain("Early-access pricing");
    expect(raw).toContain("Simple pricing for contract <GradientPhrase>tracking</GradientPhrase>.");
    expect(raw).toContain("Request early access");
    expect(raw).toContain("View product tour");
    expect(raw).toContain("paid founding monthly plan");
  });

  it("keeps unsupported public pricing and checkout claims out", () => {
    for (const phrase of [
      "$249",
      "$299",
      "$2,400",
      "$1,500",
      "21-day trial",
      "Start the <GradientPhrase>21-day trial</GradientPhrase>",
      "Founding Customer",
      "Guided Pilot",
      "Book guided pilot",
      "Need portfolio operations, controls, or assurance workflows?",
    ]) {
      expect(raw).not.toContain(phrase);
    }
  });

  it("removes structured-data offers for fixed prices", () => {
    expect(jsonLdRaw).not.toContain('"249.00"');
    expect(jsonLdRaw).not.toContain('"2400.00"');
    expect(jsonLdRaw).not.toContain('"1500.00"');
    expect(jsonLdRaw).not.toContain("Limited to the first 25 customers");
    expect(jsonLdRaw).not.toContain("60-day guided pilot");
  });
});
