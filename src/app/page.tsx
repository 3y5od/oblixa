import type { Metadata } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";

/** Public landing ISR — aligns with (marketing) segment revalidate. */
export const revalidate = 86400;

const title = "Oblixa — Contract execution for post-signature teams";
const description =
  "Turn signed contracts into tracked work, deadlines, approvals, obligations, and audit-ready evidence.";
const ogDescription =
  "Contract execution platform for post-signature operations. Upload, review, execute, and prove outcomes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "contract execution",
    "renewals",
    "contract operations",
    "obligations",
    "post-signature",
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
