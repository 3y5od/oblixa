import type { Metadata } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";

/** Public landing ISR — aligns with (marketing) segment revalidate. */
export const revalidate = 86400;

const title = "Oblixa — Track what signed contracts require next";
const description =
  "Oblixa helps small teams turn reviewed contract dates, owners, obligations, evidence, exceptions, and reports into accountable work.";
const ogDescription =
  "Upload agreements or import your tracker, review source-backed fields, and turn signed-contract follow-up into accountable work.";

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
