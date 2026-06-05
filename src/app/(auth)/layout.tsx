import type { Metadata } from "next";

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
  // layer and fills the viewport. The legal links + operational notice live
  // inside that content block (see AuthForm) so they hug the columns and the
  // luminous backdrop fills the calm space below — no viewport-pinned footer.
  return (
    <div className="landing-root relative flex min-h-screen flex-col overflow-x-clip bg-canvas text-[var(--text-primary)] antialiased">
      {children}
    </div>
  );
}
