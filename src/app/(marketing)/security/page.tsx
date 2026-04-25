import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { MarketingLegalShell } from "@/components/landing/marketing-legal-shell";

const title = "Security — Oblixa";
const description =
  "Security practices for the Oblixa contract execution platform: access, tenancy, reporting issues, and vulnerability disclosure.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/security" },
  openGraph: { title, description, url: "/security", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function SecurityPage() {
  return (
    <>
      <LegalPageJsonLd path="/security" title={title} description={description} />
      <MarketingLegalShell>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">Security</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Operational overview for customers and prospects</p>
            <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                Oblixa is built for organizations that need accountable contract execution. Security is
                handled in depth through your deployment configuration, identity provider choices, and
                administrative controls in the product.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Transport and authentication</h2>
              <p>
                Browser traffic to the application should be served over HTTPS in production. Users sign in
                through the authentication mechanisms configured for your workspace (for example email and
                password or SSO, depending on setup).
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Organization isolation</h2>
              <p>
                Product data is scoped to workspaces and organizations. Application code enforces access
                using server-side authorization aligned with your membership and role model—client-side UI
                alone is not a security boundary.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Integrations and automation</h2>
              <p>
                API keys, webhooks, and integrations should be scoped and rotated according to your policy.
                Prefer least privilege for automation that touches operational data.
              </p>
              <h2 className="mt-10 text-base font-semibold text-[var(--text-primary)]">Reporting issues</h2>
              <p>
                Vulnerability disclosure contact and machine-readable pointers are published in{" "}
                <Link href="/.well-known/security.txt" className="ui-link font-medium text-[var(--text-primary)]">
                  security.txt
                </Link>
                . Use that channel for security-sensitive reports rather than public issue trackers.
              </p>
            </div>
          </article>
        </main>
      </MarketingLegalShell>
    </>
  );
}
