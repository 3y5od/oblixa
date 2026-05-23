import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Acceptable use — Oblixa";
const description =
  "Acceptable use rules for the Oblixa contract tracking workspace. Prohibited content, fair-use AI extraction, account responsibility, and suspension grounds.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/acceptable-use" },
  openGraph: { title, description, url: "/acceptable-use", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const sections: Array<{ heading: string; body: string }> = [
  {
    heading: "What Oblixa is for",
    body: "Oblixa is a contract tracking workspace for agreements you have already signed. It helps teams review key fields, assign owners, track renewal and notice dates, manage obligations, request evidence, and produce reports. It is not a law firm, a CLM drafting tool, an e-signature platform, or an autonomous decision-making agent.",
  },
  {
    heading: "Content you may upload",
    body: "You may upload signed agreements you have a right to track — vendor contracts, customer contracts, service agreements, leases, financing agreements, partnership agreements, and similar records — together with the metadata, owners, dates, and evidence files needed to operate on them. You are responsible for the contents you upload and for confirming you have the legal right to store and share them inside your workspace.",
  },
  {
    heading: "Content you may not upload",
    body: "Do not upload material that is illegal, infringing, malicious (malware, exploit payloads), or that violates a third party's rights. Do not upload personal data of individuals who have not consented to such storage where applicable law requires their consent. Do not use Oblixa to store medical, payment-card, or other regulated data unless you have a written addendum with us that covers such data classes.",
  },
  {
    heading: "Fair-use AI extraction",
    body: "Suggested extraction is included on standard plans subject to fair use. We may temporarily throttle extraction if a single workspace runs an unusually high volume of pages relative to typical contract-tracking usage. We will contact the workspace before any sustained throttling. AI suggestions are starting points — fields stay tied to source snippets until a human approves them, and you remain responsible for verifying any field that drives reminders, work, or reports.",
  },
  {
    heading: "Account responsibility",
    body: "Each workspace is responsible for its members' actions. Admins should keep team rosters current, revoke access for departed members, and rotate API keys and integration credentials per their policy. We will not be liable for losses arising from credentials shared outside your team.",
  },
  {
    heading: "Prohibited uses",
    body: "You may not use Oblixa to circumvent our security; attempt to access another organization's workspace; scrape, mirror, or resell the product; train competing models on Oblixa's outputs; send unsolicited bulk email through our reminders system; or impersonate another person or organization. You may not use Oblixa to make automated legal decisions about third parties.",
  },
  {
    heading: "Grounds for suspension",
    body: "We may suspend or terminate access if a workspace violates these rules, exceeds plan limits without resolving them, fails to pay, or poses a security risk to other workspaces. We will give reasonable notice and a chance to remediate, except where suspension is needed urgently to protect users or comply with law.",
  },
  {
    heading: "Reporting concerns",
    body: "If you believe a workspace, member, or piece of content violates these rules, contact us so we can review. We respond to acceptable-use reports in the same channel used for security issues.",
  },
  {
    heading: "Changes to this policy",
    body: "We may update these rules from time to time. Material changes will be communicated to workspace admins. Continued use of Oblixa after a change indicates acceptance of the updated policy.",
  },
];

export default function AcceptableUsePage() {
  return (
    <>
      <LegalPageJsonLd path="/acceptable-use" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <header>
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Legal
            </p>
            <h1 className="mt-4 text-balance text-[2rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2.5rem]">
              Acceptable use
            </h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15px]">
              Plain rules for how Oblixa can be used. These rules apply alongside our Terms of
              Service and Privacy Policy. Subject to update; review with counsel for your organization.
            </p>
          </header>

          <article className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.15rem]">
                  {section.heading}
                </h2>
                <p className="mt-2 text-[14px] leading-[1.7] text-[var(--text-secondary)]">
                  {section.body}
                </p>
              </section>
            ))}
          </article>

          <footer className="mt-12 border-t border-[var(--border-subtle)] pt-6">
            <p className="text-[12.5px] text-[var(--text-tertiary)]">
              Questions or reports? See our{" "}
              <Link href="/security" className="ui-link">
                security page
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="ui-link">
                contact us
              </Link>
              .
            </p>
            <p className="mt-2 text-[12.5px] text-[var(--text-tertiary)]">
              Oblixa is not a law firm and does not provide legal advice. Users are responsible for
              reviewing contract information and making business or legal decisions.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
