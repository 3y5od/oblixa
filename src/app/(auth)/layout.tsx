import type { Metadata } from "next";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";

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
    <div className="ui-public-shell flex min-h-screen flex-col text-[var(--text-primary)] antialiased">
      <div className="flex-1">{children}</div>
      <AuthLegalFooter />
    </div>
  );
}
