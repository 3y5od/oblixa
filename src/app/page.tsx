import type { Metadata } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";

/** Public landing ISR — aligns with (marketing) segment revalidate. */
export const revalidate = 86400;

const title = "Oblixa — Replace your contract-tracking spreadsheet";
const description =
  "Oblixa helps small teams track renewals, obligations, owners, evidence, and reports from signed contracts, with AI-assisted extraction that stays source-backed and human-reviewed.";
const ogDescription =
  "Replace your contract-tracking spreadsheet with source-backed reviewed fields, owners, work, evidence, and reports.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "contract tracking",
    "contract spreadsheet",
    "renewal tracking",
    "contract renewals",
    "obligation tracking",
    "evidence tracking",
    "contract reports",
  ],
  openGraph: {
    title,
    description: ogDescription,
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: ogDescription,
    images: ["/twitter-image"],
  },
};

export default function Home() {
  return (
    <>
      <LandingJsonLd />
      <LandingPage />
    </>
  );
}
