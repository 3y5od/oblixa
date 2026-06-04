import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Download,
  History,
  KeyRound,
  Mail,
  Scale,
  Users,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";

const title = "Security — Oblixa";
const description =
  "Security basics for contract records in Oblixa early access — roles, audit history, export, deletion, account security, and AI review, with early-access limits.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/security" },
  openGraph: { title, description, url: "/security", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

// Established security contact, mirroring the in-app /settings/security page.
const SECURITY_EMAIL = "security@oblixa.com";
const SECURITY_MAILTO = `mailto:${SECURITY_EMAIL}?subject=Security%20question`;

type SecuritySection = {
  id: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  bullets: readonly string[];
  action?: { href: string };
};

const sections: readonly SecuritySection[] = [
  {
    id: "access",
    eyebrow: "Access and roles",
    title: "Membership and admin controls",
    icon: Users,
    bullets: [
      "Team member and admin roles",
      "Workspace-scoped membership and invites",
      "Admin-only settings and billing controls",
    ],
  },
  {
    id: "audit",
    eyebrow: "Audit history",
    title: "Track who changed what",
    icon: History,
    bullets: [
      "Contract uploads and field approvals",
      "Owner changes and evidence requests",
      "Exports and member changes",
    ],
  },
  {
    id: "export",
    eyebrow: "Data export and deletion",
    title: "Keep evaluation data small and reversible",
    icon: Download,
    bullets: [
      "Export contract records and reports as CSV",
      "Request deletion when an evaluation ends",
      "Start with a small or redacted contract set",
    ],
  },
  {
    id: "account",
    eyebrow: "Account security",
    title: "Authentication and sessions",
    icon: KeyRound,
    bullets: [
      "Password sign-in with self-service reset",
      "Multi-factor authentication (TOTP)",
      "Active session review and sign-out",
    ],
  },
  {
    id: "ai-review",
    eyebrow: "AI and review",
    title: "Suggested fields require human review",
    icon: BrainCircuit,
    bullets: [
      "AI-assisted extraction suggests fields from uploaded contract text",
      "Important fields should be reviewed before relying on them",
      "Source snippets let reviewers check every suggested value",
    ],
  },
  {
    id: "data-contact",
    eyebrow: "Security contact",
    title: "Questions about your data",
    icon: Mail,
    bullets: [
      "Ask how access, export, and deletion work",
      "Talk to a person before or during a limited evaluation",
    ],
    action: { href: SECURITY_MAILTO },
  },
];

export default function SecurityPage() {
  return (
    <>
      <LegalPageJsonLd path="/security" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <header className="mx-auto max-w-3xl text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Security
            </p>
            <h1
              className="mx-auto mt-3 max-w-[20ch] text-balance text-[2.35rem] font-bold leading-[1.04] tracking-tight text-[var(--text-primary)] sm:text-[3.5rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Security basics for contract records, with <GradientPhrase>early-access limits</GradientPhrase>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-[15px] leading-[1.65] text-[var(--text-secondary)] sm:text-[17px]">
              Oblixa keeps role, audit, export, deletion, and AI-review controls visible.
              Early access is not intended for teams that require formal enterprise
              security review before a limited evaluation.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/early-access"
                className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                Request early access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/privacy"
                className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
              >
                Privacy policy
              </Link>
            </div>
          </header>

          <section className="mt-12 grid gap-4 md:grid-cols-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <article
                  key={section.id}
                  id={section.id}
                  className="landing-card-premium relative flex flex-col overflow-hidden rounded-2xl border p-6"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] text-[var(--accent-strong)]">
                    <Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
                  </span>
                  <p className="ui-caps-1 mt-4 text-[10.5px] text-[var(--accent-strong)]">
                    {section.eyebrow}
                  </p>
                  <h2 className="mt-2 text-[1.15rem] font-semibold tracking-tight text-[var(--text-primary)]">
                    {section.title}
                  </h2>
                  <ul className="mt-3 grid gap-1.5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2.25} aria-hidden />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {section.action ? (
                    <Link
                      href={section.action.href}
                      className="ui-btn-ghost mt-4 inline-flex min-h-9 max-w-max items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
                    >
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                      <span>
                        Email <span className="font-mono">{SECURITY_EMAIL}</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </section>

          <section
            id="legal"
            aria-labelledby="security-legal-h"
            className="relative mt-10 overflow-hidden rounded-2xl border p-6 sm:p-7"
            style={{
              borderColor: "color-mix(in oklab, var(--warning-ink) 28%, var(--border-subtle))",
              background: "color-mix(in oklab, var(--warning-soft) 18%, var(--surface-raised))",
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "color-mix(in oklab, var(--warning-ink) 22%, var(--border-subtle))",
                  background: "var(--surface-raised)",
                  color: "var(--warning-ink)",
                }}
              >
                <Scale className="h-5 w-5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--warning-ink)]">
                  <span className="landing-eyebrow-dot" aria-hidden />
                  Legal note
                </p>
                <h2
                  id="security-legal-h"
                  className="mt-2 text-[1rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[1.1rem]"
                >
                  Oblixa does not provide legal advice
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                  Oblixa is not a law firm and does not provide legal advice. Your team
                  remains responsible for reviewing contract information and making
                  business or legal decisions.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
