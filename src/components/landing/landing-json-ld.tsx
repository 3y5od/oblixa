import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { faqItems, softwareFeatureList } from "@/components/landing/landing-content";
import { serializeJsonLdForInlineScript } from "@/lib/security/json-ld-inline-script";

export function LandingJsonLd() {
  const base = getAppBaseUrlFromEnv();

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oblixa",
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}/icon`,
    },
    description:
      "Contract execution platform for post-signature operations: renewals, approvals, obligations, and audit-ready evidence.",
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Oblixa",
    url: base,
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

  const payload = [organization, website, faqPage, software];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLdForInlineScript(payload) }}
    />
  );
}
