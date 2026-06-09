import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pricing contract", () => {
  const raw = readFileSync(join(process.cwd(), "src/app/(marketing)/pricing/page.tsx"), "utf8");
  const jsonLdRaw = readFileSync(
    join(process.cwd(), "src/components/landing/landing-json-ld.tsx"),
    "utf8"
  );

  it("publishes the decided Core offer plainly", () => {
    // Per oblixa-release-state.md §Billing, Pricing, And Cancellation, the
    // public Core price ($249/month per workspace, month-to-month) must be
    // shown plainly — not hidden behind "price disclosure" language.
    expect(raw).toContain("Pricing");
    expect(raw).toContain("Simple pricing for contract follow-up.");
    expect(raw).toContain("$249");
    expect(raw).toMatch(/month-to-month/i);
    expect(raw).toContain("Request access");
    expect(raw).toContain("Included features");
  });

  it("keeps unsupported pricing, checkout, and hidden-price claims out", () => {
    for (const phrase of [
      // Drifted in-app billing figures must not surface in public copy.
      "$299",
      "$2,988",
      // Retired tier prices.
      "$2,400",
      "$1,500",
      // Trial / founding / pilot framing is not part of the release offer.
      "21-day trial",
      "Start the <GradientPhrase>21-day trial</GradientPhrase>",
      "Founding Customer",
      "Guided Pilot",
      "Book guided pilot",
      // Hidden-price and access-first positioning are removed.
      "after price disclosure",
      "Access and pricing",
      "Need portfolio operations, controls, or assurance workflows?",
    ]) {
      expect(raw).not.toContain(phrase);
    }
  });

  it("keeps structured-data offers free of fixed prices", () => {
    // The visible page publishes the price; structured data still carries no
    // Offer node (compatibility routes must not add structured-data offers).
    expect(jsonLdRaw).not.toContain('"249.00"');
    expect(jsonLdRaw).not.toContain('"2400.00"');
    expect(jsonLdRaw).not.toContain('"1500.00"');
    expect(jsonLdRaw).not.toContain("Limited to the first 25 customers");
    expect(jsonLdRaw).not.toContain("60-day guided pilot");
  });
});
