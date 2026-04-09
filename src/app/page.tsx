import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Oblixa — Contract execution for post-signature teams",
  description:
    "Turn signed contracts into tracked work, deadlines, approvals, obligations, and audit-ready evidence.",
  openGraph: {
    title: "Oblixa — Contract execution for post-signature teams",
    description:
      "Contract execution platform for post-signature operations. Upload, review, execute, and prove outcomes.",
  },
};

export default function Home() {
  return <LandingPage />;
}
