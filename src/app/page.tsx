import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "ContractOps — Contract operations for service teams",
  description:
    "Centralize agreements, approve AI-extracted renewal and notice fields with source snippets, and get reminders your team can trust.",
  openGraph: {
    title: "ContractOps — Contract operations for service teams",
    description:
      "Operational contract dates without enterprise CLM. Upload, extract, human review, reminders.",
  },
};

export default function Home() {
  return <LandingPage />;
}
