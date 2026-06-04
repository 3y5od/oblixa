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

describe("Billing page early-access release state", () => {
  it("uses subdued early-access billing strings", () => {
    expect(SETTINGS_BILLING_STRINGS.primaryCta).toBe("Contact support about billing");
    expect(SETTINGS_BILLING_STRINGS.secondaryCta).toBe("Review early-access pricing");
    expect(SETTINGS_BILLING_STRINGS.emptyStateBody).toBe(
      "Billing is secondary during early access."
    );
    expect(SETTINGS_BILLING_STRINGS.trialMicrocopyParts).toEqual([
      "Early access",
      "Billing after evaluation",
    ]);
    expect(SETTINGS_BILLING_STRINGS.faq).toContain("What happens after evaluation?");
  });

  it("does not publish fixed public plan prices or free-trial checkout copy", () => {
    for (const phrase of [
      "$249",
      "$299",
      "billed annually",
      "Choose annual plan",
      "Continue monthly",
      "Convert to paid plan",
      "21-day free trial",
      "Guided Pilot",
      "Founding Customer Offer",
    ]) {
      expect(pageSrc).not.toContain(phrase);
      expect(specSrc).not.toContain(phrase);
    }
  });

  it("keeps checkout behind an explicit fail-closed environment gate", () => {
    expect(pageSrc).toContain("billingCheckoutEnabled");
    expect(pageSrc).toContain("Public billing checkout is disabled during early access");
    expect(checkoutSrc).toContain("isPublicBillingCheckoutEnabled");
    expect(checkoutSrc).toContain("billing_checkout_not_enabled");
    expect(checkoutSrc).toContain("OBLIXA_ENABLE_PUBLIC_BILLING_CHECKOUT=1");
  });

  it("keeps portal access for existing billing records while routing no-plan users to support", () => {
    expect(pageSrc).toContain("<ManageSubscriptionButton />");
    expect(pageSrc).toContain("<BillingHelpActions />");
    expect(pageSrc).toContain("Evaluation billing");
    expect(pageSrc).toContain("EARLY ACCESS");
    expect(pageSrc).toContain("Founding monthly plan after evaluation");
  });

  it("does not create a trial by default in checkout", () => {
    expect(checkoutSrc).toContain("checkout adds a trial only if explicitly configured");
    expect(checkoutSrc).toContain("trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}");
    expect(checkoutSrc).not.toContain(": 21");
  });
});
