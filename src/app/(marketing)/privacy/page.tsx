import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Baby,
  Clock,
  Database,
  MessagesSquare,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { ActionChip } from "@/components/ui/action-chip";

const title = "Privacy — Oblixa";
const description =
  "How Oblixa handles account data, workspace content, uploaded contract files, and operational activity for signed-contract follow-up.";

const LAST_REVIEWED_ISO = "2026-05-28";
const LAST_REVIEWED_DISPLAY = "May 28, 2026";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title, description, url: "/privacy", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const CONTENTS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "#process", label: "What we process" },
  { href: "#why", label: "Why" },
  { href: "#ai", label: "AI use" },
  { href: "#providers", label: "Providers" },
  { href: "#access", label: "Access" },
  { href: "#retention", label: "Retention" },
  { href: "#rights", label: "Your rights" },
  { href: "#contact", label: "Contact" },
];

const RELATED: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/security", label: "Security" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/contact", label: "Contact" },
];

const PROCESSED: ReadonlyArray<{ term: string; detail: string }> = [
  { term: "Account and sign-in", detail: "Name, email, and authentication identifiers." },
  { term: "Billing data", detail: "Subscription and payment status (card data is held by our billing provider)." },
  { term: "Workspace and team", detail: "Membership, roles, and workspace identity." },
  { term: "Uploaded contract files", detail: "Signed agreements you upload (PDF, DOCX)." },
  { term: "Extracted text and reviewed fields", detail: "Document text and the fields your team reviews." },
  { term: "Operational records", detail: "Tasks, approvals, obligations, reminders, and evidence." },
  { term: "Activity and audit events", detail: "Who did what, with actor and timestamp." },
  { term: "Exports and reports", detail: "CSV exports and operational reports you generate." },
  { term: "Access requests and contact messages", detail: "What you send through public forms." },
  { term: "Technical and security logs", detail: "Request metadata and error diagnostics." },
];

const ROLES = ["Owner", "Admin", "Member", "Viewer"] as const;

export default function PrivacyPage() {
  return (
    <>
      <LegalPageJsonLd path="/privacy" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-50" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <Shield className="h-5 w-5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
                  <span className="landing-eyebrow-dot" aria-hidden />
                  Privacy practices
                </p>
                <h1 className="mt-1 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  Privacy
                </h1>
                <span className="mt-2 inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] px-2.5 py-0.5">
                  <span className="ui-caps-2 text-[9.5px] leading-none text-[var(--text-tertiary)]">Last reviewed</span>
                  <time dateTime={LAST_REVIEWED_ISO} className="text-[11px] font-medium leading-none tabular-nums text-[var(--text-secondary)]">
                    {LAST_REVIEWED_DISPLAY}
                  </time>
                </span>
              </div>
            </div>

            <p className="mt-5 max-w-prose text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              This page explains how Oblixa processes information in the product. For contractual commitments,
              rely on your agreement with Oblixa and any order form or data processing terms your organization
              executes.
            </p>

            <nav
              aria-label="On this page"
              className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4"
            >
              <span className="ui-caps-3 mr-1 text-[var(--text-tertiary)]">On this page</span>
              {CONTENTS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,transparent)] px-2.5 py-1 text-[12px] font-medium leading-none text-[var(--text-secondary)] outline-none transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:text-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className="ui-caps-3 text-[var(--text-tertiary)]">More policies</span>
              {RELATED.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-sm text-[var(--text-tertiary)] underline-offset-2 outline-none transition-colors hover:text-[var(--accent-strong)] hover:underline focus-visible:text-[var(--accent-strong)] focus-visible:underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </article>

          <section className="mt-3">
            <PolicyCard id="process" eyebrow="Information we process" title="What we process" icon={Database}>
              <dl className="grid gap-x-10 sm:grid-cols-2">
                {PROCESSED.map((item) => (
                  <div
                    key={item.term}
                    className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] py-2.5"
                  >
                    <dt className="text-[12.5px] font-semibold text-[var(--text-primary)]">{item.term}</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-secondary)]">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </PolicyCard>
          </section>

          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <PolicyCard id="why" eyebrow="Purpose" title="Why we process it" icon={ShieldCheck}>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                We use this information to provide the signed-contract follow-up features you configure, to
                authenticate users, to enforce workspace boundaries, to send the operational notifications you
                enable, and to keep the service secure and reliable.
              </p>
            </PolicyCard>

            <PolicyCard id="ai" eyebrow="AI and review" title="AI-assisted extraction" icon={Sparkles}>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Where you use extraction, uploaded files or extracted text may be sent to an AI provider only to
                suggest operational fields. A source snippet backs each suggestion where available, and values are
                not trusted until your team reviews and approves them. Oblixa does not provide legal advice.
              </p>
              <p className="mt-2.5 text-[12px] leading-snug text-[var(--text-tertiary)]">
                You remain responsible for only uploading data your organization is authorized to process.
              </p>
            </PolicyCard>
          </section>

          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <PolicyCard id="providers" eyebrow="Service providers" title="Providers and subprocessors" icon={Server}>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                We rely on service providers (subprocessors) to operate Oblixa — for hosting and storage, email
                delivery, billing, and AI-assisted extraction. We work to limit each provider to the data needed
                for its function.
              </p>
            </PolicyCard>

            <PolicyCard id="access" eyebrow="Access controls" title="Access and workspace controls" icon={Users}>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Workspace data is visible to members of that workspace, scoped by role. Cross-workspace access is
                blocked. Authorized Oblixa support may access data only with controls and audit when needed to
                operate or troubleshoot the service.
              </p>
              <div className="mt-3">
                <p className="ui-caps-3 text-[var(--text-tertiary)]">Roles</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ROLES.map((role) => (
                    <span
                      key={role}
                      className="ui-caps-3 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_50%,transparent)] px-1.5 py-0.5 text-[var(--text-tertiary)]"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </PolicyCard>
          </section>

          <section className="mt-6 grid gap-x-10 gap-y-6 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-6 sm:grid-cols-2">
            <FlatSection id="retention" eyebrow="Retention" title="How long records are kept" icon={Clock}>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Retention depends on your workspace configuration and administrative actions — exports, deletions,
                and contract lifecycle in the product. Administrators control retention through in-product tools
                and organizational policy. Some records, such as audit history, are retained to keep the service
                secure and accountable.
              </p>
            </FlatSection>

            <FlatSection id="rights" eyebrow="Your data" title="Your rights" icon={UserCog}>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Your rights over personal data — to access, correct, delete, or export it — depend on your
                jurisdiction. In the product you can export contract records and reports as CSV, and workspace
                data deletion is available by request.
              </p>
              <p className="mt-2.5 text-[12px] leading-snug text-[var(--text-tertiary)]">
                Many operational records are controlled by your workspace administrators — contact your admin
                first, then use the contact path below.
              </p>
            </FlatSection>
          </section>

          <section
            id="children"
            aria-labelledby="privacy-children-h"
            className="mt-6 flex items-start gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5"
          >
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
            >
              <Baby className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Children</p>
              <h2 id="privacy-children-h" className="mt-0.5 text-[1rem] font-semibold tracking-tight text-[var(--text-primary)]">
                Intended for business use
              </h2>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                The service is not directed to children and is intended for business use.
              </p>
            </div>
          </section>

          <section className="mt-6">
            <PolicyCard id="contact" eyebrow="Contact" title="Privacy and data requests" icon={MessagesSquare}>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
                <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  For privacy, export, or deletion requests, contact Oblixa. Signed-in users can also reach
                  support from inside the product; if you are not signed in, use the contact page.
                </p>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <ActionChip verb="Contact Oblixa" href="/contact" />
                  <ActionChip verb="Security practices" href="/security" />
                </div>
              </div>
            </PolicyCard>
          </section>
        </div>
      </main>
    </>
  );
}

function PolicyCard({
  id,
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      className="relative flex scroll-mt-24 flex-col rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-5"
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
        aria-hidden
      >
        <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
      </span>
      <p className="ui-caps-1 mt-3.5 text-[10.5px] text-[var(--accent-strong)]">{eyebrow}</p>
      <h2 className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      <div className="mt-3 flex-1">{children}</div>
    </article>
  );
}

function FlatSection({
  id,
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div id={id} className="flex scroll-mt-24 items-start gap-3">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
        aria-hidden
      >
        <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
      </span>
      <div className="min-w-0">
        <p className="ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">{eyebrow}</p>
        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
