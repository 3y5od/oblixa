import type { Metadata } from "next";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { MarketingLegalShell } from "@/components/landing/marketing-legal-shell";

const title = "Terms of use — Oblixa";
const description =
  "Terms governing use of the Oblixa contract execution platform. Subject to update; review with counsel for your organization.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: { title, description, url: "/terms", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function TermsPage() {
  return (
    <>
      <LegalPageJsonLd path="/terms" title={title} description={description} />
      <MarketingLegalShell>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">Terms of use</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Last updated: {new Date().toISOString().slice(0, 10)}</p>
            <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                These terms are a general, public-facing summary for visitors evaluating Oblixa. Binding
                commercial terms for your organization may be set out in a separate agreement, order form,
                or online checkout flow. Have qualified counsel review any contract before you rely on it.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Acceptable use</h2>
              <p>
                You agree not to misuse the service—including attempting to access workspaces you are not
                authorized for, probing the service in ways that could harm availability or security, or
                uploading unlawful content. Administrators are responsible for how their organization uses
                Oblixa.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Accounts</h2>
              <p>
                You are responsible for safeguarding credentials and for activity performed under your
                account. Notify your administrator if you suspect unauthorized access.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Disclaimers</h2>
              <p>
                Oblixa helps teams run post-signature contract operations. It does not provide legal
                advice, legal analysis, or a substitute for qualified counsel. You remain responsible for
                your agreements, compliance obligations, and decisions.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Service changes</h2>
              <p>
                Features and interfaces may change as the product evolves. Material changes to customer
                agreements will be handled through the channel that governs your subscription (for example
                updated terms presented in-product or via your vendor process).
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Governing law</h2>
              <p>
                If no separate contract applies, the governing law and venue for disputes may be determined
                by Oblixa&apos;s corporate formation and operational policies. This placeholder section
                should be replaced with counsel-approved language for your go-to-market.
              </p>
            </div>
          </article>
        </main>
      </MarketingLegalShell>
    </>
  );
}
