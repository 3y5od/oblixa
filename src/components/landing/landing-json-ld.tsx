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
      "Contract tracking workspace for renewals, requirements, owners, evidence, and reports from signed agreements.",
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Oblixa",
    url: base,
    description:
      "Track what signed contracts require next with reviewed dates, owners, requirements, evidence, problems, tasks, and reports.",
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
      "Contract tracking workspace for renewals, requirements, owners, evidence, and reports from signed agreements.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    featureList: [...softwareFeatureList],
  };

  const payload = [
    organization,
    website,
    faqPage,
    software,
  ];

  return <JsonLdScript payload={payload} />;
}
