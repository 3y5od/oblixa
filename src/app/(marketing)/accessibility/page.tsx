import type { Metadata } from "next";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { MarketingLegalShell } from "@/components/landing/marketing-legal-shell";

const title = "Accessibility — Oblixa";
const description =
  "Accessibility commitment for Oblixa marketing pages and the product experience. Feedback welcome.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/accessibility" },
  openGraph: { title, description, url: "/accessibility", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function AccessibilityPage() {
  return (
    <>
      <LegalPageJsonLd path="/accessibility" title={title} description={description} />
      <MarketingLegalShell>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <p className="ui-eyebrow">Public commitments</p>
            <h1 className="ui-display-title mt-3 text-2xl sm:text-3xl">Accessibility</h1>
            <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                We aim to keep primary flows keyboard accessible, preserve visible focus, and use semantic
                structure on public marketing pages. The authenticated product is exercised in CI with
                accessibility checks on a defined route matrix; coverage expands as surfaces evolve.
              </p>
              <p>
                If you cannot complete a task because of a barrier in the UI, contact your workspace
                administrator or the support channel your organization uses for Oblixa so we can route
                feedback to the right team.
              </p>
            </div>
          </article>
        </main>
      </MarketingLegalShell>
    </>
  );
}
