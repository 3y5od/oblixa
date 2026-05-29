import type { Metadata } from "next";
import {
  Baby,
  Clock,
  Database,
  MessagesSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Privacy — Oblixa";
const description =
  "How Oblixa handles account data, workspace content, and operational activity for contract execution.";
const LAST_REVIEWED_ISO = "2026-05-28";

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
                <Shield className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Privacy practices
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  Privacy
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Last updated: {LAST_REVIEWED_ISO}
                </p>
              </div>
            </div>

            <p className="mt-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              This page describes how Oblixa processes information in the product. It is a high-level summary
              and may be updated as the service changes. For contractual commitments, rely on your agreement
              with Oblixa and any order form or data processing terms your organization executes.
            </p>

            <div className="mt-10 space-y-7">
              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Database className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">What we process</h2>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    <li>
                      <strong>Account data</strong> such as name, email, and authentication identifiers needed to
                      operate sign-in and workspace membership.
                    </li>
                    <li>
                      <strong>Workspace and contract operations data</strong> you enter or upload—including
                      agreement files, extracted fields, tasks, approvals, reminders, and audit events tied to your
                      organization&apos;s use of the product.
                    </li>
                    <li>
                      <strong>Technical and security data</strong> such as logs required to run, secure, and
                      troubleshoot the service (for example request metadata and error diagnostics), subject to your
                      deployment configuration and retention practices.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Why we process it</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    We use this information to provide the contract execution features you configure, to
                    authenticate users, to enforce organization boundaries, to send operational notifications you
                    enable, and to maintain the security and reliability of the service.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">AI-assisted extraction</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Where you use extraction features, content you upload may be processed to suggest operational
                    fields. Your team remains responsible for reviewing and approving values before they drive
                    workflows. Oblixa does not provide legal advice.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Retention</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Retention depends on your workspace configuration, integrations, and administrative actions
                    (for example exports, deletions, or contract lifecycle in the product). Administrators should use
                    in-product tools and organizational policy to manage how long records are kept.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <UserCog className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Your rights</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Depending on your jurisdiction, you may have rights to access, correct, delete, or export
                    personal data. Workspace administrators typically control membership and many operational
                    records; contact your admin first, then reach out through the support channel your organization
                    uses for Oblixa.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Baby className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Children</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    The service is not directed to children and is intended for business use.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_20%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] p-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Contact</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    For privacy requests, use the support process established for your workspace. If you are unsure
                    who that is, start from an authenticated session in the product or ask your organization&apos;s
                    Oblixa administrator.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
