import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { serializeJsonLdForInlineScript } from "@/lib/security/json-ld-inline-script";

type LegalJsonLdProps = {
  path: "/privacy" | "/terms" | "/security" | "/accessibility" | "/cookies";
  title: string;
  description: string;
};

export function LegalPageJsonLd({ path, title, description }: LegalJsonLdProps) {
  const base = getAppBaseUrlFromEnv();
  const url = `${base}${path}`;

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: "Oblixa",
      url: base,
      logo: {
        "@type": "ImageObject",
        url: `${base}/apple-icon`,
      },
    },
    isPartOf: {
      "@type": "WebSite",
      name: "Oblixa",
      url: base,
    },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: base,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: url,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLdForInlineScript([webPage, breadcrumbs]) }}
    />
  );
}
