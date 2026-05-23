import type { Metadata } from "next";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { MarketingPageWrapper } from "@/components/ui/marketing-page-wrapper";

export const metadata: Metadata = {
  title: "Sign in — Oblixa",
  description: "Access your Oblixa workspace to manage contracts, tasks, and approvals.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-root relative flex min-h-screen flex-col bg-canvas text-[var(--text-primary)] antialiased">
      <div aria-hidden className="landing-header-backdrop" />
      <MarketingPageWrapper>
        <div className="flex-1">{children}</div>
      </MarketingPageWrapper>
      <AuthLegalFooter />
    </div>
  );
}
