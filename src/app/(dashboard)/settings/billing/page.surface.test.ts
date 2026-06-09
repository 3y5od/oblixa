import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/billing/page.tsx");
const CHECKOUT = join(process.cwd(), "src/app/api/stripe/checkout/route.ts");
const SPEC_STRINGS = join(process.cwd(), "src/lib/settings/spec-strings.ts");

const pageSrc = readFileSync(PAGE, "utf8");
const checkoutSrc = readFileSync(CHECKOUT, "utf8");
const specSrc = readFileSync(SPEC_STRINGS, "utf8");

describe("Billing page access and billing release state", () => {
  it("uses subdued access-first billing strings", () => {
    expect(SETTINGS_BILLING_STRINGS.primaryCta).toBe("Contact support about billing");
    expect(SETTINGS_BILLING_STRINGS.secondaryCta).toBe("Review access and pricing");
    expect(SETTINGS_BILLING_STRINGS.emptyStateBody).toBe(
      "Billing is available only after access approval."
    );
    expect(SETTINGS_BILLING_STRINGS.trialMicrocopyParts).toEqual([
      "Reviewed access",
      "Billing after approval",
    ]);
    expect(SETTINGS_BILLING_STRINGS.faq).toContain("What happens after access review?");
  });

  it("publishes the Core price plainly but avoids unsupported packaging", () => {
    // Release-state: $249/month per workspace, shown plainly, charged only
    // after access approval + explicit checkout.
    expect(SETTINGS_BILLING_STRINGS.corePrice.display).toBe("$249");
    expect(pageSrc).toContain("corePrice.display");
    for (const phrase of [
      "$299",
      "billed annually",
      "Choose annual plan",
      "Continue monthly",
      "Convert to paid plan",
      "21-day free trial",
      "Guided Pilot",
      "Founding Customer Offer",
      // Single month-to-month offer: no annual/monthly checkout variant split,
      // no founding-coupon checkout (retired with the founding banner).
      'variant="annual"',
      'variant="monthly"',
    ]) {
      expect(pageSrc).not.toContain(phrase);
      expect(specSrc).not.toContain(phrase);
    }
  });

  it("uses release-safe access language (no 'evaluation' as a trial synonym)", () => {
    expect(SETTINGS_BILLING_STRINGS.trialEndedLabel).not.toMatch(/evaluation/i);
    expect(SETTINGS_BILLING_STRINGS.faq.join(" ")).not.toMatch(/evaluation/i);
    expect(
      Object.values(SETTINGS_BILLING_STRINGS.placeholders).join(" ")
    ).not.toMatch(/evaluation/i);
    expect(pageSrc).not.toMatch(/\bevaluation\b/i);
  });

  it("keeps checkout behind an explicit fail-closed environment gate", () => {
    expect(pageSrc).toContain("billingCheckoutEnabled");
    expect(pageSrc).toContain("Public billing checkout is available only after access approval");
    expect(checkoutSrc).toContain("isPublicBillingCheckoutEnabled");
    expect(checkoutSrc).toContain("billing_checkout_not_enabled");
    expect(checkoutSrc).toContain("OBLIXA_ENABLE_PUBLIC_BILLING_CHECKOUT=1");
  });

  it("keeps portal access for existing billing records while routing no-plan users to support", () => {
    expect(pageSrc).toContain("<ManageSubscriptionButton />");
    expect(pageSrc).toContain("<BillingHelpActions />");
    expect(pageSrc).toContain("Access review billing");
    expect(pageSrc).toContain("Access review");
  });

  it("does not create a trial by default in checkout", () => {
    expect(checkoutSrc).toContain("checkout adds a trial only if explicitly configured");
    expect(checkoutSrc).toContain("trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}");
    expect(checkoutSrc).not.toContain(": 21");
  });
});
