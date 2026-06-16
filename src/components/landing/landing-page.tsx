import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";
import { BestFitSection, TrustSection } from "./landing-best-fit-trust";
import { HeroSection, ProblemSection } from "./landing-hero-problem";
import { OutcomesSection, CompareSection } from "./landing-outcomes-compare";
import { ClosingSection, PricingCtaSection } from "./landing-pricing-closing";
import { CapabilitiesSection, HowItWorksSection } from "./landing-workflow-capabilities";

export function LandingPage() {
  return (
    <div className="lp-root relative flex min-h-full flex-col overflow-x-clip bg-canvas">
      <MarketingSiteHeader />

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <CapabilitiesSection />
        <OutcomesSection />
        <CompareSection />
        <BestFitSection />
        <TrustSection />
        <PricingCtaSection />
        <ClosingSection />
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
