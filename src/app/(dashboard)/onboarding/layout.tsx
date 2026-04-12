import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[min(72vh,40rem)] bg-canvas py-6 motion-reduce:transition-none sm:py-10">
      <div className="mx-auto w-full max-w-2xl px-3 sm:px-5">{children}</div>
    </div>
  );
}
