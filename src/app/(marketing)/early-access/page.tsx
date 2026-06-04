import type { Metadata } from "next";
import { redirect } from "next/navigation";

const title = "Request Access — Oblixa";
const description =
  "Request reviewed workspace access to Oblixa.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/request-access" },
  openGraph: { title, description, url: "/request-access", type: "article" },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: false, follow: true },
};

export default function EarlyAccessPage() {
  redirect("/request-access");
}
