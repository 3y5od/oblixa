import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  FileText,
  History,
  KeyRound,
  LockKeyhole,
  Plug,
  Scale,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { PreFooterCta } from "@/components/marketing/pre-footer-cta";
import { GradientPhrase } from "@/components/ui/gradient-phrase";

const title = "Security — Oblixa";
const description =
  "How Oblixa handles permissions, audit history, exportability, transport, tenant isolation, and vulnerability disclosure.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/security" },
  openGraph: { title, description, url: "/security", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const LAST_REVIEWED_ISO = "2026-05-14";
const SECURITY_EMAIL = "security@oblixa.com" as const;
const SECURITY_MAILTO = `mailto:${SECURITY_EMAIL}` as const;

type Tone = "cool" | "warm" | "amber" | "success";

const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  cool: {
    color: "var(--accent-strong)",
    bg: "color-mix(in oklab, var(--accent-soft) 36%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--accent) 24%, var(--border-subtle))",
  },
  warm: {
    color: "var(--accent-warm, var(--accent))",
    bg: "color-mix(in oklab, var(--accent-soft) 28%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--accent-warm, var(--accent)) 22%, var(--border-subtle))",
  },
  amber: {
    color: "var(--warning-ink)",
    bg: "color-mix(in oklab, var(--warning-soft) 28%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--warning-ink) 22%, var(--border-subtle))",
  },
  success: {
    color: "var(--success-ink)",
    bg: "color-mix(in oklab, var(--success-soft) 28%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--success-ink) 22%, var(--border-subtle))",
  },
};

type PhaseId = "access" | "data" | "transport" | "contact";

const PHASES: ReadonlyArray<{
  id: PhaseId;
  number: string;
  label: string;
  description: string;
  tone: Tone;
}> = [
  {
    id: "access",
    number: "1",
    label: "Access & accountability",
    description: "Who can see and change what — and what gets logged.",
    tone: "cool",
  },
  {
    id: "data",
    number: "2",
    label: "Data handling",
    description: "What you can take with you — and what we keep out.",
    tone: "warm",
  },
  {
    id: "transport",
    number: "3",
    label: "Transport & isolation",
    description: "How traffic reaches your workspace and how it's scoped.",
    tone: "cool",
  },
  {
    id: "contact",
    number: "4",
    label: "Account & contact",
    description: "Sign-in, programmatic access, and how to reach us.",
    tone: "warm",
  },
];

type Section = {
  id: string;
  phaseId: PhaseId;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  bullets?: readonly string[];
  bulletNodes?: readonly ReactNode[];
  body?: ReactNode;
  bulletIcon?: LucideIcon;
};

const SECTIONS: readonly Section[] = [
  {
    id: "access",
    phaseId: "access",
    icon: Users,
    eyebrow: "Access and roles",
    title: "Membership and admin controls",
    bullets: [
      "Team member roles",
      "Admin controls",
      "Workspace-level permissions",
      "Restricted access to sensitive areas",
    ],
  },
  {
    id: "audit",
    phaseId: "access",
    icon: History,
    eyebrow: "Audit history",
    title: "Track who changed what",
    bullets: [
      // Spec-verbatim per docs/oblixa-release-state.md §Security Page > Audit History.
      "Track important changes",
      "See who changed key records",
      "Review contract activity",
    ],
  },
  {
    id: "export",
    phaseId: "data",
    icon: Download,
    eyebrow: "Data export",
    title: "Keep control of your data",
    bullets: [
      // Spec-verbatim per docs/oblixa-release-state.md §Security Page > Data Export.
      "Export reports",
      "Export contract records",
      "Keep control of your data",
    ],
  },
  {
    id: "not-stored",
    phaseId: "data",
    icon: ShieldCheck,
    eyebrow: "Exclusions",
    title: "What we don't store",
    bulletNodes: [
      <Fragment key="cards">
        <strong className="font-semibold text-[var(--text-primary)]">Payment card details</strong>
        {" "}— handled by our payment processor
      </Fragment>,
      <Fragment key="passwords">
        <strong className="font-semibold text-[var(--text-primary)]">Plain-text passwords</strong>
        {" "}— credentials are hashed at rest
      </Fragment>,
      <Fragment key="ai">
        <strong className="font-semibold text-[var(--text-primary)]">Contract content</strong>
        {" "}— we don&apos;t train external models on your data
      </Fragment>,
    ],
  },
  {
    id: "transport",
    phaseId: "transport",
    icon: LockKeyhole,
    eyebrow: "Transport and authentication",
    title: "How requests reach the workspace",
    bullets: [
      "Browser traffic over HTTPS in production",
      "Authentication configured per workspace",
      "Email and password or SSO, depending on setup",
    ],
  },
  {
    id: "isolation",
    phaseId: "transport",
    icon: Server,
    eyebrow: "Organization isolation",
    title: "Workspace boundaries are server-enforced",
    bullets: [
      "Product data scoped to workspaces",
      "Authorization enforced server-side, not in the UI",
      "Aligned with your membership and role model",
    ],
  },
  {
    id: "integrations",
    phaseId: "transport",
    icon: Plug,
    eyebrow: "Integrations and automation",
    title: "Least-privilege keys and service accounts",
    bullets: [
      "Least privilege for API keys and webhooks",
      "Rotate keys per your policy",
      "Service accounts for automation, not user credentials",
    ],
  },
  {
    id: "account",
    phaseId: "contact",
    icon: KeyRound,
    eyebrow: "Account security",
    title: "Authentication and session safety",
    bullets: [
      // Spec-verbatim per docs/oblixa-release-state.md §Security Page > Account Security.
      "MFA where available",
      "Secure sessions",
      "Password-based login",
      "Team access management",
    ],
  },
  {
    id: "dpa",
    phaseId: "contact",
    icon: FileText,
    eyebrow: "Privacy and DPA",
    title: "How to reach us",
    bulletNodes: [
      <Link
        key="dpa"
        href="/contact?interested=dpa"
        prefetch={false}
        className="ui-link inline-flex items-baseline gap-1 font-medium text-[var(--text-primary)]"
      >
        Request a Data Processing Addendum (DPA)
        <ArrowUpRight className="h-3 w-3 self-center" strokeWidth={1.85} aria-hidden />
      </Link>,
      <span key="email" className="inline-flex flex-wrap items-baseline gap-1">
        Email security questions:
        <a
          href={SECURITY_MAILTO}
          className="ui-link inline-flex items-baseline gap-1 font-medium text-[var(--text-primary)]"
        >
          {SECURITY_EMAIL}
          <ArrowUpRight className="h-3 w-3 self-center" strokeWidth={1.85} aria-hidden />
        </a>
      </span>,
      <Link
        key="privacy"
        href="/privacy"
        className="ui-link inline-flex items-baseline gap-1 font-medium text-[var(--text-primary)]"
      >
        Privacy policy
        <ArrowUpRight className="h-3 w-3 self-center" strokeWidth={1.85} aria-hidden />
      </Link>,
    ],
  },
  {
    id: "subprocessors",
    phaseId: "contact",
    icon: Server,
    eyebrow: "Subprocessors",
    title: "Third-party services that may process your data",
    bulletNodes: [
      <Fragment key="list">Current list available on request</Fragment>,
      <Fragment key="email">
        Email{" "}
        <a
          href={SECURITY_MAILTO}
          className="ui-link font-medium text-[var(--text-primary)]"
        >
          {SECURITY_EMAIL}
        </a>
        {" "}for the latest list
      </Fragment>,
      <Fragment key="notify">Notification preferences on request</Fragment>,
    ],
  },
];

const TRUST_PRINCIPLES: ReadonlyArray<{
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  tone: Tone;
  anchor: string;
}> = [
  {
    id: "auth",
    icon: LockKeyhole,
    title: "Server-side authorization",
    body: "Access checks run server-side. The browser UI is never the security boundary.",
    tone: "cool",
    anchor: "#access",
  },
  {
    id: "isolation",
    icon: Server,
    title: "Tenant isolation",
    body: "Your workspace data is scoped to your organization. Membership and roles govern who sees what.",
    tone: "cool",
    anchor: "#isolation",
  },
  {
    id: "disclosure",
    icon: ShieldCheck,
    title: "No public issue trackers",
    body: "Vulnerability reports go to our published security.txt channel. We acknowledge within 1 business day.",
    tone: "amber",
    anchor: "#reporting",
  },
];

function SectionCard({
  section,
  index,
  total,
}: {
  section: Section;
  index: number;
  total: number;
}) {
  const phase = PHASES.find((p) => p.id === section.phaseId);
  const tone = TONE[phase ? phase.tone : "cool"];
  const Icon = section.icon;
  const BulletIcon = section.bulletIcon ?? Check;
  const headingId = `security-${section.id}-h`;
  const bulletCount =
    (section.bullets?.length ?? 0) + (section.bulletNodes?.length ?? 0);
  const grid = bulletCount >= 4 ? "sm:grid-cols-2" : "";

  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      className="security-anchor landing-card-premium group relative overflow-hidden rounded-2xl border p-6 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-strong))] sm:p-7"
    >
      <span
        aria-hidden
        className="landing-corner-ring"
        style={{ top: "-1.5rem", right: "-1.5rem", width: "6rem", height: "6rem" }}
      />
      <span
        aria-hidden
        className="absolute right-4 top-4 z-10 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70"
        style={{
          color: tone.color,
          fontVariantNumeric: "tabular-nums lining-nums slashed-zero",
        }}
      >
        {index} / {total}
      </span>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
          style={{ borderColor: tone.border, background: tone.bg, color: tone.color }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="ui-caps-1 inline-flex items-center gap-1.5 text-[10.5px]"
            style={{ color: tone.color }}
          >
            <span className="landing-eyebrow-dot" aria-hidden />
            {section.eyebrow}
          </p>
          <h3
            id={headingId}
            className="mt-2 text-[1rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[1.125rem]"
          >
            {section.title}
          </h3>
          {section.body !== undefined ? (
            <p className="mt-2 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
              {section.body}
            </p>
          ) : null}
          {section.bullets ? (
            <ul className={`mt-3 grid gap-1.5 ${grid}`}>
              {section.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]"
                >
                  <BulletIcon
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.25}
                    style={{ color: tone.color }}
                    aria-hidden
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {section.bulletNodes ? (
            <ul className={`mt-3 grid gap-2 ${grid}`}>
              {section.bulletNodes.map((node, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]"
                >
                  <BulletIcon
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.25}
                    style={{ color: tone.color }}
                    aria-hidden
                  />
                  <span className="min-w-0">{node}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PhaseHeader({ phase }: { phase: (typeof PHASES)[number] }) {
  const tone = TONE[phase.tone];
  return (
    <header className="relative">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] to-transparent"
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6">
        <span
          className="text-[12px] font-bold uppercase tracking-[0.18em]"
          style={{ color: tone.color, fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
        >
          Phase {phase.number}
        </span>
        <h2
          id={`security-phase-${phase.id}-h`}
          className="text-[1.125rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.25rem]"
        >
          {phase.label}
        </h2>
      </div>
      <p className="mt-1 text-[13px] leading-[1.55] text-[var(--text-tertiary)]">
        {phase.description}
      </p>
    </header>
  );
}

export default function SecurityPage() {
  const totalSections = SECTIONS.length;
  const sectionIndex = new Map<string, number>(
    SECTIONS.map((s, i) => [s.id, i + 1])
  );

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
        <span
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-32 hidden h-[480px] w-[480px] rounded-full opacity-50 blur-3xl md:block"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--accent-strong) 8%, transparent), transparent 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-40 bottom-12 hidden h-[480px] w-[480px] rounded-full opacity-40 blur-3xl md:block"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--success-ink) 8%, transparent), transparent 70%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          {/* Hero — medallion dropped (it competed with the landing-eyebrow-dot
              when both sat in the centered stack). Cross-page parity with
              /pricing hero which is eyebrow-only. */}
          <header className="text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Security
            </p>
            <h1
              className="mx-auto mt-3 max-w-[22ch] text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[3rem] md:text-[3.5rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Built for <GradientPhrase>sensitive contract records</GradientPhrase>.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[16px]">
              Oblixa helps teams manage signed contract records with permissions, audit history, exportability, and security controls.
            </p>
            {/* Hero CTA — security-aligned only. Registration ("Start free trial")
                and the trial disclaimer were removed: /security is an
                informational page for security reviewers, not a signup funnel.
                Conversion lives on /pricing. */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/contact?interested=dpa"
                prefetch={false}
                className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                Request DPA
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
            </div>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span className="px-3 py-1.5">
                  <span className="tabular-nums text-[var(--text-secondary)]">{totalSections}</span> sections
                </span>
                <span className="px-3 py-1.5">
                  Last reviewed{" "}
                  <span className="tabular-nums text-[var(--text-secondary)]">{LAST_REVIEWED_ISO}</span>
                </span>
                <span className="px-3 py-1.5">Security.txt published</span>
              </div>
            </div>
          </header>

          {/* Trust principles strip */}
          <section
            aria-label="Trust principles"
            className="relative mt-10 grid gap-3 sm:mt-12 sm:grid-cols-3"
          >
            {TRUST_PRINCIPLES.map((p) => {
              const t = TONE[p.tone];
              const Icon = p.icon;
              return (
                <article
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl border bg-[var(--surface-raised)] p-5 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-strong))] sm:p-6"
                  style={{
                    borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)",
                    borderLeftWidth: "2px",
                    borderLeftColor: t.color,
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ borderColor: t.border, background: t.bg, color: t.color }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.85} />
                  </span>
                  <p className="mt-3 text-[13.5px] font-semibold text-[var(--text-primary)]">
                    {p.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--text-secondary)]">
                    {p.body}
                  </p>
                  <Link
                    href={p.anchor}
                    className="ui-link mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Read more
                    <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                  </Link>
                </article>
              );
            })}
          </section>

          {/* Phase wrappers with section cards.
              At lg+, 2-card phases render side by side; 3-card phases render
              the lead card full-width with the remaining two side by side.
              This breaks the centered-stack monotony at desktop widths. */}
          {PHASES.map((phase, phaseIdx) => {
            const sections = SECTIONS.filter((s) => s.phaseId === phase.id);
            const renderCard = (section: Section) => (
              <SectionCard
                key={section.id}
                section={section}
                index={sectionIndex.get(section.id) ?? 0}
                total={totalSections}
              />
            );
            return (
              <section
                key={phase.id}
                aria-labelledby={`security-phase-${phase.id}-h`}
                className={phaseIdx === 0 ? "mt-12 sm:mt-14" : "mt-10 sm:mt-12"}
              >
                <PhaseHeader phase={phase} />
                {sections.length === 3 ? (
                  <div className="mt-5 space-y-3 sm:space-y-4">
                    {renderCard(sections[0])}
                    <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                      {renderCard(sections[1])}
                      {renderCard(sections[2])}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 sm:gap-4 lg:grid-cols-2">
                    {sections.map(renderCard)}
                  </div>
                )}
              </section>
            );
          })}

          {/* Closing CTA — vulnerability reporting (was the small "Reporting issues" card) */}
          <section
            id="reporting"
            aria-labelledby="security-reporting-h"
            className="landing-card-premium relative mt-16 overflow-hidden rounded-3xl border p-8 text-center sm:mt-20 sm:p-12"
          >
            <span
              aria-hidden
              className="landing-corner-ring"
              style={{ top: "-2rem", right: "-2rem", width: "8rem", height: "8rem" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in oklab, var(--success-ink) 14%, transparent), transparent 70%)",
              }}
            />
            <div className="relative">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--success-ink)]">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success-ink)]" />
                Report a vulnerability
              </p>
              <h2
                id="security-reporting-h"
                className="mt-3 text-balance text-[1.75rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[2.125rem]"
              >
                Reach the security team.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--text-secondary)]">
                Acknowledged within 1 business day.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={SECURITY_MAILTO}
                  className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                >
                  Email {SECURITY_EMAIL}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </a>
                <a
                  href="/.well-known/security.txt"
                  className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
                >
                  Open security.txt
                </a>
              </div>
              <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
                <Link
                  href="/privacy"
                  className="ui-link inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Privacy policy
                  <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                </Link>
              </p>
            </div>
          </section>

          {/* Legal note — moved to bottom foot meta (was mid-page warning band) */}
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
                  Important — Legal note
                </p>
                <h3
                  id="security-legal-h"
                  className="mt-2 text-[1rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[1.1rem]"
                >
                  Oblixa does not provide legal advice
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                  Oblixa is not a law firm and does not provide legal advice. Users are
                  responsible for reviewing contract information and making business or legal
                  decisions.
                </p>
              </div>
            </div>
          </section>

          {/* Pre-footer CTA — global pattern matching landing + product. */}
          <PreFooterCta
            leading="Start the "
            wedge="21-day trial"
            trailing="."
            primary={{ label: "Start free trial", href: "/signup" }}
            tertiary={{ label: "Talk to the founder", href: "/contact?interested=security" }}
          />

          {/* Meta footer strip — replaces orphan "Last reviewed" line */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="inline-flex flex-wrap divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <span className="px-3 py-1.5">Maintained by security team</span>
              <span className="px-3 py-1.5">Security.txt published</span>
              <span className="px-3 py-1.5">DPA available on request</span>
            </div>
            <a
              href="#main-content"
              className="ui-link inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              Back to top
              <ArrowUpRight className="h-3 w-3 rotate-[-45deg]" strokeWidth={1.85} aria-hidden />
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
