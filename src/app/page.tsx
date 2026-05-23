import type { Metadata } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";

/** Public landing ISR — aligns with (marketing) segment revalidate. */
export const revalidate = 86400;

const title = "Oblixa — Track renewals, obligations, and owners from signed contracts";
const description =
  "Oblixa replaces contract tracking spreadsheets with a workspace for reviewed terms, key dates, assigned owners, obligation follow-up, evidence, and reports.";
const ogDescription =
  "Replace your contract tracking spreadsheet with a workspace for renewals, owners, obligations, evidence, and reports.";

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
