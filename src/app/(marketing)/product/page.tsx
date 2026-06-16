import type { Metadata } from "next";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { JsonLdScript } from "@/components/landing/landing-json-ld";
import { ProductMobileCta } from "@/components/landing/product-mobile-cta";
import {
  ActivationSection,
  HeroSection,
  TransformationSection,
} from "@/app/(marketing)/product/product-page-top-sections";
import {
  ClosingSection,
  ProductWorkflowSections,
} from "@/app/(marketing)/product/product-page-workflow";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";

const title = "Product — Oblixa";
const description =
  "Oblixa replaces the contract tracking spreadsheet. Confirmed terms, key dates, owners, contract requirements, evidence, and reports — connected in one workspace.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/product" },
  openGraph: { title, description, url: "/product", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

function ProductHowToJsonLd() {
  const base = getAppBaseUrlFromEnv();
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to replace your contract tracking spreadsheet with Oblixa",
    description:
      "Move from a static contract spreadsheet to a workspace that tracks renewals, owners, contract requirements, evidence, and reports.",
    totalTime: "PT30M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Upload signed contracts or import a spreadsheet",
        url: `${base}/product#upload`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Confirm suggested contract details against source text",
        url: `${base}/product#review`,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Assign owners, reminders, confirmations, and tasks",
        url: `${base}/product#work`,
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Track renewals, evidence, problems, and reports",
        url: `${base}/product#reports`,
      },
    ],
  };
  return <JsonLdScript payload={[howTo]} />;
}

export default function ProductPage() {
  return (
    <>
      <LegalPageJsonLd path="/product" title={title} description={description} />
      <ProductHowToJsonLd />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex min-h-full flex-1 flex-col overflow-x-clip bg-canvas outline-none"
      >
        <span id="top" aria-hidden className="absolute top-0" />
        <HeroSection />
        <TransformationSection />
        <ActivationSection />
        <ProductWorkflowSections />
        <ClosingSection />
        <ProductMobileCta />
      </main>
    </>
  );
}
