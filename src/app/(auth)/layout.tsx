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
  // Single coherent backdrop: the auth <main> renders its own `landing-luminous`
  // layer, so the page no longer stacks a header-backdrop + marketing atmosphere
  // on top of it. Rendering children directly as a flex child lets the main fill
  // the viewport and keeps the legal footer pinned to the bottom.
  return (
    <div className="landing-root relative flex min-h-screen flex-col overflow-x-clip bg-canvas text-[var(--text-primary)] antialiased">
      {children}
      <AuthLegalFooter />
    </div>
  );
}
