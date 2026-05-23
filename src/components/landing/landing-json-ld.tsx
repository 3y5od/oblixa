import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { faqItems, softwareFeatureList } from "@/components/landing/landing-content";
import { serializeJsonLdForInlineScript } from "@/lib/security/json-ld-inline-script";

export function JsonLdScript({ payload }: { payload: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLdForInlineScript(payload) }}
    />
  );
}

export function LandingJsonLd() {
  const base = getAppBaseUrlFromEnv();

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oblixa",
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}/apple-icon`,
    },
    description:
      "Contract tracking workspace for renewals, obligations, owners, evidence, and reports from signed agreements.",
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Oblixa",
    url: base,
    description:
      "Replace your contract tracking spreadsheet with a workspace for renewals, owners, obligations, evidence, and reports.",
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Oblixa",
    description:
      "Contract tracking workspace for renewals, obligations, owners, evidence, and reports from signed agreements.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    featureList: [...softwareFeatureList],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Create a workspace and upload agreements to get started.",
    },
  };

  /* v3 — Offer JSON-LD for the Core plan ($249/month billed annually).
     Enables rich pricing results in SERP. */
  const corePlanOffer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: "Oblixa Core",
    description:
      "Up to 500 active contracts, up to 10 team members, AI-assisted extraction with source-backed review, renewals, obligations, evidence requests, reports, and CSV export.",
    url: `${base}/pricing`,
    priceCurrency: "USD",
    price: "249.00",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "249.00",
      priceCurrency: "USD",
      unitText: "MONTH",
      referenceQuantity: {
        "@type": "QuantitativeValue",
        value: "12",
        unitText: "MONTH",
      },
    },
    eligibleQuantity: {
      "@type": "QuantitativeValue",
      maxValue: 500,
      unitText: "CONTRACT",
    },
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: "Oblixa",
      url: base,
    },
  };

  /* v4 — Founding Customer offer JSON-LD (first 25 customers, $2,400 for Year 1). */
  const foundingCustomerOffer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: "Oblixa Founding Customer",
    description:
      "First-year discount on Oblixa Core: $2,400 for Year 1 (saves $588 vs the standard $2,988 annual price). Limited to the first 25 customers.",
    url: `${base}/pricing`,
    priceCurrency: "USD",
    price: "2400.00",
    availability: "https://schema.org/LimitedAvailability",
    eligibleQuantity: {
      "@type": "QuantitativeValue",
      maxValue: 25,
      unitText: "CUSTOMER",
    },
    seller: {
      "@type": "Organization",
      name: "Oblixa",
      url: base,
    },
  };

  /* v4 — Guided Pilot offer JSON-LD ($1,500 for a 60-day guided pilot, credited toward Year 1). */
  const guidedPilotOffer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: "Oblixa Guided Pilot",
    description:
      "60-day guided pilot for $1,500. Includes a kickoff call, help picking the first contract set, owner and key-date definition, and review of the first reports. Credited toward the first annual Oblixa Core plan if you continue.",
    url: `${base}/pricing`,
    priceCurrency: "USD",
    price: "1500.00",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "1500.00",
      priceCurrency: "USD",
      unitText: "DAY",
      referenceQuantity: {
        "@type": "QuantitativeValue",
        value: "60",
        unitText: "DAY",
      },
    },
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: "Oblixa",
      url: base,
    },
  };

  const payload = [
    organization,
    website,
    faqPage,
    software,
    corePlanOffer,
    foundingCustomerOffer,
    guidedPilotOffer,
  ];

  return <JsonLdScript payload={payload} />;
}
