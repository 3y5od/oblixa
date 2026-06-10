import type { Metadata, Viewport } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";
import { lpSerif } from "@/components/landing/lp-fonts";

/** Public landing ISR — aligns with (marketing) segment revalidate. */
export const revalidate = 86400;

const title = "Oblixa — Track what signed contracts require next";
const description =
  "Oblixa helps small teams turn reviewed contract dates, owners, requirements, evidence, and problems into accountable tasks and exportable reports.";
const ogDescription =
  "Upload agreements or import your tracker, confirm suggested contract details, and turn signed-contract follow-up into accountable tasks.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "contract tracking",
    "contract spreadsheet",
    "renewal tracking",
    "contract renewals",
    "contract requirement tracking",
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

/** Warm paper theme color for the migrated, light-locked homepage. The root
 *  layout keeps the app's cool light/dark pair for unmigrated routes. */
export const viewport: Viewport = {
  themeColor: "#f7f4ea",
};

export default function Home() {
  return (
    <>
      <LandingJsonLd />
      {/* display: contents — the serif font variable cascades into .lp-root
          without adding a layout box. Loaded here (not the root layout) so
          product-app routes never ship the marketing typeface. */}
      <div className={lpSerif.variable} style={{ display: "contents" }}>
        <LandingPage />
      </div>
    </>
  );
}
