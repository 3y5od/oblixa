import type { Metadata } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";
import { lpSerif } from "@/components/landing/lp-fonts";

/** Public landing ISR — aligns with (marketing) segment revalidate. */
export const revalidate = 86400;

const title = "Oblixa — Track what signed contracts require next";
const description =
  "Oblixa identifies renewal dates, notice windows, and owners in signed contracts. Your team confirms each item before reminders, tasks, or reports use it.";
const ogDescription =
  "Upload signed contracts or import your tracker. Oblixa identifies renewal dates, notice windows, and owners — your team confirms each item before it is used.";

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
