import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "External action — Oblixa",
  description: "Complete your requested action on a secure Oblixa link.",
  robots: { index: false, follow: false },
};

export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
