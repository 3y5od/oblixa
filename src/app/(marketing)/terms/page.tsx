import type { Metadata } from "next";
import { FileText, Handshake, KeyRound, Scale, MessagesSquare, RefreshCw } from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Terms of use — Oblixa";
const description =
  "Terms governing use of the Oblixa contract tracking workspace. Subject to update; review with counsel for your organization.";
const LAST_REVIEWED_ISO = "2026-05-28";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: { title, description, url: "/terms", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const sections = [
  {
    icon: Handshake,
    title: "Acceptable use",
    body: "You agree not to misuse the service—including attempting to access workspaces you are not authorized for, probing the service in ways that could harm availability or security, or uploading unlawful content. Administrators are responsible for how their organization uses Oblixa.",
  },
  {
    icon: KeyRound,
    title: "Accounts",
    body: "You are responsible for safeguarding credentials and for activity performed under your account. Notify your administrator if you suspect unauthorized access.",
  },
  {
    icon: MessagesSquare,
    title: "Disclaimers",
    body: "Oblixa helps teams run post-signature contract operations. It does not provide legal advice, legal analysis, or a substitute for qualified counsel. You remain responsible for your agreements, compliance obligations, and decisions.",
  },
  {
    icon: RefreshCw,
    title: "Service changes",
    body: "Features and interfaces may change as the product evolves. Material changes to customer agreements will be handled through the channel that governs your subscription (for example updated terms presented in-product or via your vendor process).",
  },
  {
    icon: Scale,
    title: "Governing law",
    body: "If no separate contract applies, the governing law and venue for disputes may be determined by Oblixa's corporate formation and operational policies. This placeholder section should be replaced with counsel-approved language for your go-to-market.",
  },
] as const;

export default function TermsPage() {
  return (
    <>
      <LegalPageJsonLd path="/terms" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-7 sm:p-10">
            <div className="flex items-start gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Service terms
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  Terms of use
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Last updated: {LAST_REVIEWED_ISO}
                </p>
              </div>
            </div>

            <p className="mt-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              These terms are a general, public-facing summary for visitors evaluating Oblixa. Binding
              commercial terms for your organization may be set out in a separate agreement, order form, or
              online checkout flow. Have qualified counsel review any contract before you rely on it.
            </p>

            <div className="mt-10 space-y-7">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.title} className="flex gap-4">
                    <span
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                      aria-hidden
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">{section.title}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{section.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
