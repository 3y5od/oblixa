import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  Download,
  FileText,
  History,
  KeyRound,
  Mail,
  MinusCircle,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Security — Oblixa";
const description =
  "How Oblixa handles signed contract files: workspace-scoped access, roles, audit history, export and deletion, account security, and human-reviewed suggestions.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/security" },
  openGraph: { title, description, url: "/security", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const SECURITY_EMAIL = "security@oblixa.io";
const SECURITY_MAILTO = `mailto:${SECURITY_EMAIL}?subject=Security%20question`;

const HERO_LEAD =
  "Security basics for contract records, with reviewed access — what's logged, who can see a workspace, and how data is exported, deleted, and reviewed.";

const TRUST_FACTS = ["Workspace access", "Audit history", "CSV exports", "Deletion requests", "Confirmed details"] as const;

const FILE_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Upload types", v: "PDF and DOCX" },
  { k: "Stored data", v: "Files, extracted text, confirmed details" },
  { k: "Access", v: "Workspace-scoped users, by role" },
  { k: "Isolation", v: "Cross-workspace access blocked" },
  { k: "In transit", v: "Encrypted over HTTPS" },
  { k: "AI provider", v: "Sent only to support extraction suggestions" },
];

const PROCESSED: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Account", v: "Profile and sign-in" },
  { k: "Workspace", v: "Team and membership" },
  { k: "Contracts", v: "Uploaded files, extracted text, confirmed details" },
  { k: "Activity", v: "Audit and activity events" },
  { k: "Public requests", v: "Access requests and contact messages" },
  { k: "Exports", v: "Reports and CSV files" },
];

const NON_CLAIMS = [
  "No public security attestation claimed",
  "No SLA or uptime guarantee",
  "No legal advice or autonomous decisions",
  "No formal enterprise security review, managed migration, or procurement readiness",
] as const;

const ROLES = ["Owner", "Admin", "Member", "Viewer"] as const;

const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]";

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
        <div aria-hidden className="landing-luminous__glow opacity-30" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-12 pt-4 sm:px-6 sm:pb-14 sm:pt-6">
          <header className="mx-auto max-w-2xl text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Security
            </p>
            <h1
              className="mx-auto mt-3 max-w-[18ch] text-balance text-[2rem] font-bold leading-[1.06] tracking-tight text-[var(--text-primary)] sm:text-[2.6rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Security for signed contract follow-up.
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-balance text-[13.5px] leading-[1.6] text-[var(--text-secondary)] sm:text-[14.5px]">
              {HERO_LEAD}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="/request-access"
                className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/privacy"
                className="ui-btn-secondary inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
              >
                Privacy policy
              </Link>
              <Link
                href="#contact"
                className={`ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold ${HAIRLINE}`}
              >
                Contact security
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
              {TRUST_FACTS.map((fact) => (
                <li
                  key={fact}
                  className="rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,transparent)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-secondary)]"
                >
                  {fact}
                </li>
              ))}
            </ul>
          </header>

          <section className="mt-8">
            <article
              id="files"
              className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-5 sm:p-6"
            >
              <div className="flex items-start gap-3.5">
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                  aria-hidden
                >
                  <FileText className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">Contract files</p>
                  <h2 className="mt-1 text-[1.15rem] font-semibold tracking-tight text-[var(--text-primary)]">
                    How contract files are handled
                  </h2>
                </div>
              </div>
              <dl className="mt-4 grid gap-x-10 sm:grid-cols-2">
                {FILE_FACTS.map((fact) => (
                  <Fact key={fact.k} k={fact.k} v={fact.v} />
                ))}
                <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t py-2 sm:col-span-2 ${HAIRLINE}`}>
                  <dt className="ui-caps-2 shrink-0 text-[10px] text-[var(--text-tertiary)]">Review state</dt>
                  <dd className="min-w-0 text-right text-[12.5px] leading-snug text-[var(--text-secondary)]">
                    Suggested details are not operational data until confirmed
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <Link
                  href="/privacy"
                  className="ui-link inline-flex items-center gap-1 text-[12.5px] font-medium"
                >
                  See how we handle data
                  <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </article>
          </section>

          <section className={`mt-7 border-t pt-5 ${HAIRLINE}`}>
            <ColumnHead icon={Database} eyebrow="What we process" title="Data categories" />
            <dl className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {PROCESSED.map((row) => (
                <Fact key={row.k} k={row.k} v={row.v} />
              ))}
            </dl>
          </section>

          <section className={`mt-7 grid gap-x-10 gap-y-6 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)] ${HAIRLINE}`}>
            <div className="lg:pr-6">
              <ColumnHead icon={Users} eyebrow="Access and roles" title="Membership and admin controls" />
              <dl>
                <Fact
                  k="Roles"
                  v={
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {ROLES.map((role) => (
                        <span
                          key={role}
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] ${HAIRLINE}`}
                        >
                          {role}
                        </span>
                      ))}
                    </span>
                  }
                />
                <Fact k="Membership" v="Scoped to one workspace" />
                <Fact k="Owner & Admin" v="Billing and settings" />
              </dl>
            </div>

            <div className="lg:px-6">
              <ColumnHead icon={History} eyebrow="Audit history" title="Key workspace actions" />
              <dl>
                <Fact k="Logged" v="Uploads and detail confirmations" />
                <Fact k="Also" v="Owner, evidence, and member changes" />
                <Fact k="Per event" v="Actor and timestamp" />
              </dl>
            </div>

            <div className="lg:pl-6">
              <ColumnHead icon={KeyRound} eyebrow="Account security" title="Authentication and sessions" />
              <dl>
                <Fact k="Sign-in" v="Password with self-service reset" />
                <Fact k="MFA" v="Authenticator app (TOTP)" />
                <Fact k="Sessions" v="Review and sign out sessions" />
                <Fact k="Sensitive actions" v="Require password confirmation" />
              </dl>
            </div>
          </section>

          <section className={`mt-7 grid gap-x-10 gap-y-6 border-t pt-5 md:grid-cols-2 md:divide-x md:divide-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)] ${HAIRLINE}`}>
            <div className="md:pr-8">
              <ColumnHead icon={Download} eyebrow="Data export and deletion" title="Export and deletion paths" />
              <dl>
                <Fact k="Export" v="Contract records and reports as CSV" />
                <Fact k="Deletion" v="Workspace data, by request" />
              </dl>
              <p className="mt-2.5 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                A first workspace can start with a small or redacted contract set.
              </p>
            </div>

            <div className="md:pl-8">
              <ColumnHead icon={Sparkles} eyebrow="AI and review" title="Suggested details require human review" />
              <dl>
                <Fact k="Review state" v="Not operational data until confirmed" />
                <Fact k="Source" v="Snippet tied to each suggestion" />
                <Fact k="Verify" v="A source snippet backs each value" />
              </dl>
            </div>
          </section>

          <section aria-labelledby="security-boundaries-h" className={`mt-7 border-t pt-5 ${HAIRLINE}`}>
            <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Boundaries</p>
            <h2
              id="security-boundaries-h"
              className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]"
            >
              What we do not claim
            </h2>
            <ul className="mt-2.5 grid max-w-2xl gap-1.5">
              {NON_CLAIMS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px] leading-[1.45] text-[var(--text-tertiary)]">
                  <MinusCircle className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="contact" className={`mt-7 border-t pt-5 ${HAIRLINE}`}>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <ColumnHead icon={Mail} eyebrow="Security contact" title="Questions about your data" />
                <p className="max-w-md text-[12.5px] leading-snug text-[var(--text-secondary)]">
                  For access, export, and deletion questions, AI and data-handling questions, or to
                  report a security concern.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Link
                  href={SECURITY_MAILTO}
                  className="ui-btn-secondary inline-flex min-h-9 max-w-max items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  <span>
                    Email <span className="font-mono">{SECURITY_EMAIL}</span>
                  </span>
                </Link>
                <Link
                  href="/contact"
                  className="ui-btn-secondary inline-flex min-h-9 max-w-max items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Contact page
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <section id="legal" aria-labelledby="security-legal-h" className={`mt-7 flex gap-3 border-t pt-5 ${HAIRLINE}`}>
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
            <div className="min-w-0">
              <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Legal note</p>
              <h2
                id="security-legal-h"
                className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                Oblixa does not provide legal advice
              </h2>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
                Oblixa is not a law firm and does not provide legal advice. Your team reviews
                suggestions before acting. See the{" "}
                <Link href="/terms" className="ui-link font-medium">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/acceptable-use" className="ui-link font-medium">
                  acceptable use
                </Link>{" "}
                policies.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] py-1.5 first:border-t-0 first:pt-0">
      <dt className="ui-caps-2 shrink-0 text-[10px] text-[var(--text-tertiary)]">{k}</dt>
      <dd className="min-w-0 text-right text-[12.5px] leading-snug text-[var(--text-secondary)]">{v}</dd>
    </div>
  );
}

function ColumnHead({ icon: Icon, eyebrow, title }: { icon: LucideIcon; eyebrow: string; title: string }) {
  return (
    <div className="mb-3">
      <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-[0.95rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
    </div>
  );
}
