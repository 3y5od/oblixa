import type { Metadata } from "next";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { MarketingLegalShell } from "@/components/landing/marketing-legal-shell";

const title = "Privacy — Oblixa";
const description =
  "How Oblixa handles account data, workspace content, and operational activity for contract execution.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title, description, url: "/privacy", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function PrivacyPage() {
  return (
    <>
      <LegalPageJsonLd path="/privacy" title={title} description={description} />
      <MarketingLegalShell>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Privacy</h1>
            <p className="mt-2 text-sm text-zinc-600">Last updated: {new Date().toISOString().slice(0, 10)}</p>
            <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-zinc-700">
              <p>
                This page describes how Oblixa processes information in the product. It is a high-level
                summary and may be updated as the service changes. For contractual commitments, rely on
                your agreement with Oblixa and any order form or data processing terms your organization
                executes.
              </p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">What we process</h2>
              <ul className="list-disc pl-5">
                <li>
                  <strong>Account data</strong> such as name, email, and authentication identifiers needed
                  to operate sign-in and workspace membership.
                </li>
                <li>
                  <strong>Workspace and contract operations data</strong> you enter or upload—including
                  agreement files, extracted fields, tasks, approvals, reminders, and audit events tied to
                  your organization&apos;s use of the product.
                </li>
                <li>
                  <strong>Technical and security data</strong> such as logs required to run, secure, and
                  troubleshoot the service (for example request metadata and error diagnostics), subject to
                  your deployment configuration and retention practices.
                </li>
              </ul>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">Why we process it</h2>
              <p>
                We use this information to provide the contract execution features you configure, to
                authenticate users, to enforce organization boundaries, to send operational notifications
                you enable, and to maintain the security and reliability of the service.
              </p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">AI-assisted extraction</h2>
              <p>
                Where you use extraction features, content you upload may be processed to suggest
                operational fields. Your team remains responsible for reviewing and approving values before
                they drive workflows. Oblixa does not provide legal advice.
              </p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">Retention</h2>
              <p>
                Retention depends on your workspace configuration, integrations, and administrative actions
                (for example exports, deletions, or contract lifecycle in the product). Administrators should
                use in-product tools and organizational policy to manage how long records are kept.
              </p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">Your rights</h2>
              <p>
                Depending on your jurisdiction, you may have rights to access, correct, delete, or export
                personal data. Workspace administrators typically control membership and many operational
                records; contact your admin first, then reach out through the support channel your
                organization uses for Oblixa.
              </p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">Children</h2>
              <p>The service is not directed to children and is intended for business use.</p>
              <h2 className="mt-10 text-base font-semibold text-zinc-900">Contact</h2>
              <p>
                For privacy requests, use the support process established for your workspace. If you are
                unsure who that is, start from an authenticated session in the product or ask your
                organization&apos;s Oblixa administrator.
              </p>
            </div>
          </article>
        </main>
      </MarketingLegalShell>
    </>
  );
}
