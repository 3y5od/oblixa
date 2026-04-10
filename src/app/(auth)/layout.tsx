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
  return (
    <div className="min-h-screen bg-canvas text-zinc-900 antialiased">
      {children}
    </div>
  );
}
