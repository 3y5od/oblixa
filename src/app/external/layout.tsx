import type { Metadata } from "next";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";

export const metadata: Metadata = {
  title: "External action — Oblixa",
  description: "Complete your requested action on a secure Oblixa link.",
  robots: { index: false, follow: false },
};

export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-public-minimal-shell flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <AuthLegalFooter />
    </div>
  );
}
