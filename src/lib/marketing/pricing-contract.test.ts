import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pricing v10 contract test — locks the element-level chrome shipped on
 * 2026-05-15 and refined 2026-05-16 (the "do-not-touch" register from
 * docs/site-visual-density-pass.md Tier 16).
 *
 * Any subsequent visual pass that breaks one of these pins fails CI fast.
 */
describe("pricing v10 contract", () => {
  const raw = readFileSync(
    join(process.cwd(), "src", "app", "(marketing)", "pricing", "page.tsx"),
    "utf8"
  );
  const jsonLdRaw = readFileSync(
    join(process.cwd(), "src", "components", "landing", "landing-json-ld.tsx"),
    "utf8"
  );

  // Hero (Tier 16.1)
  it("preserves the hero h1 + GradientPhrase wedge + sub", () => {
    expect(raw).toContain("Simple pricing for");
    expect(raw).toContain("<GradientPhrase>contract tracking</GradientPhrase>");
    expect(raw).toContain("One plan. No seat upsell. Cancel anytime.");
  });

  // Sub-nav labels (Tier 16.2)
  it("preserves the 5 sub-nav anchor labels", () => {
    expect(raw).toContain('{ href: "#oblixa-core", label: "Core" }');
    expect(raw).toContain('{ href: "#founding-customer", label: "Founding" }');
    expect(raw).toContain('{ href: "#guided-pilot", label: "Pilot" }');
    expect(raw).toContain('{ href: "#custom-plans", label: "Custom" }');
    expect(raw).toContain('{ href: "#pricing-faq-heading", label: "FAQ" }');
  });

  // Core card top-band (Tier 16.3)
  it("preserves the Core card top-band stamp + price + chip pair + trial strip", () => {
    expect(raw).toContain("Oblixa Core");
    expect(raw).toContain("$249");
    expect(raw).toContain("/mo");
    expect(raw).toContain("Annual");
    expect(raw).toContain("$249/mo");
    expect(raw).toContain("Monthly");
    expect(raw).toContain("$299/mo");
    expect(raw).toContain("21</span>-day trial");
    expect(raw).toContain("25</span>contracts");
    expect(raw).toContain("3</span>users");
    expect(raw).toContain("CSV export");
    expect(raw).toContain("No credit card");
  });

  // Core feature grid (Tier 16.4)
  it("preserves the 5 Core feature-grid category headings", () => {
    expect(raw).toContain('heading: "Limits"');
    expect(raw).toContain('heading: "Capture"');
    expect(raw).toContain('heading: "Day-to-day"');
    expect(raw).toContain('heading: "Output"');
    expect(raw).toContain('heading: "Team & support"');
  });

  // Founding card (Tier 16.5)
  it("preserves the Founding Customer card chrome", () => {
    expect(raw).toContain("Limited launch offer");
    expect(raw).toContain("Founding Customer");
    expect(raw).toContain("First 25 customers");
    expect(raw).toContain("$2,400");
    expect(raw).toContain("Save $588");
    expect(raw).toContain("First year");
    expect(raw).toContain("Auto-renews");
    expect(raw).toContain("$2,988/yr");
    expect(raw).toContain("Claim founding spot");
  });

  // Pilot card (Tier 16.6)
  it("preserves the Guided Pilot card chrome (chip on its own row, not item-baseline)", () => {
    expect(raw).toContain("Guided Pilot");
    expect(raw).toContain("$1,500");
    expect(raw).toContain("Credited to Core");
    expect(raw).toContain("60-day pilot");
    expect(raw).toContain("Book guided pilot");
  });

  // Custom plans (Tier 16.7)
  it("preserves the Custom plans spec list", () => {
    expect(raw).toContain("Custom plans");
    expect(raw).toContain("Need portfolio operations, controls, or assurance workflows?");
    expect(raw).toContain("500+");
    expect(raw).toContain("10+");
    expect(raw).toContain("Contact us");
  });

  // FAQ (Tier 16.8)
  it("preserves the FAQ section h2 + sub + category IDs", () => {
    expect(raw).toContain("Pricing questions");
    expect(raw).toContain("Everything you might want to know");
    expect(raw).toContain("faq-trial-card");
    expect(raw).toContain("faq-annual-billing");
    expect(raw).toContain("faq-setup-help");
  });

  // Closing CTA (Tier 16.9)
  it("preserves the closing CTA chrome", () => {
    expect(raw).toContain("Ready to start");
    expect(raw).toContain("Start the <GradientPhrase>21-day trial</GradientPhrase>");
    expect(raw).toContain("Talk to the founder");
    expect(raw).toContain("Read the FAQ");
    expect(raw).toContain("USD");
    expect(raw).toContain("Excludes taxes");
    expect(raw).toContain("Subject to change");
  });

  // Negative pins — confirmed-dropped prose must not reappear
  it("does not regress to pre-v10 dropped prose", () => {
    expect(raw).not.toContain("Annual billing. $299/month monthly.");
    expect(raw).not.toContain("Save $588 versus the standard annual price.");
    expect(raw).not.toContain("Applied to your first annual plan if you continue.");
    expect(raw).not.toContain("Or talk to founder");
    expect(raw).not.toContain("Or skim the pricing FAQ");
    expect(raw).not.toContain("Hands-on setup");
    expect(raw).not.toContain("Start with Core; add larger-team workflows");
  });

  // JSON-LD descriptions (Tier 16.10)
  it("preserves the JSON-LD price + first-25 + 60-day pilot pins", () => {
    expect(jsonLdRaw).toContain('"249.00"');
    expect(jsonLdRaw).toContain('"2400.00"');
    expect(jsonLdRaw).toContain('"1500.00"');
    expect(jsonLdRaw).toContain("Limited to the first 25 customers");
    expect(jsonLdRaw).toContain("60-day guided pilot");
  });
});
