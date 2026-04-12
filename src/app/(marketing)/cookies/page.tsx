import type { Metadata } from "next";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { MarketingLegalShell } from "@/components/landing/marketing-legal-shell";

const title = "Cookies — Oblixa";
const description =
  "How Oblixa uses cookies and similar technologies for sign-in, security, and essential product operation.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/cookies" },
  openGraph: { title, description, url: "/cookies", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function CookiesPage() {
  return (
    <>
      <LegalPageJsonLd path="/cookies" title={title} description={description} />
      <MarketingLegalShell>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Cookies</h1>
            <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-zinc-700">
              <p>
                Like most web applications, Oblixa uses cookies and similar storage to keep you signed in,
                protect sessions, and operate core security controls. Marketing pages on this site do not
                add third-party advertising cookies as part of this implementation.
              </p>
              <p>
                If your organization introduces additional analytics or marketing scripts, update this page
                and your consent approach to match what is actually deployed.
              </p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">Managing cookies</h2>
              <p>
                You can control cookies through browser settings. Clearing cookies may sign you out of the
                product until you authenticate again.
              </p>
            </div>
          </article>
        </main>
      </MarketingLegalShell>
    </>
  );
}
