import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Check,
  FileText,
  Flag,
  MinusCircle,
  PauseCircle,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { ActionChip } from "@/components/ui/action-chip";

const title = "Acceptable use — Oblixa";
const description =
  "Acceptable use rules for Oblixa, the signed-contract follow-up workspace: what you can upload, fair-use AI extraction, account responsibility, prohibited conduct, and grounds for suspension.";

// Pinned review marker (LAST_REVIEWED_ISO) feeds the trust-compliance freshness
// check; LABEL is the human-readable display. Keep both in sync by hand — the
// surface check forbids a runtime review date.
const LAST_REVIEWED_ISO = "2026-05-28";
const LAST_REVIEWED_LABEL = "May 28, 2026";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/acceptable-use" },
  openGraph: { title, description, url: "/acceptable-use", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]";
const DIVIDE = "divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]";
const POLICY_BAND = "bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,transparent)]";

// Small accent-tinted square that leads every section header — matches the
// icon-row idiom on /privacy, /terms, /cookies, and /accessibility.
const SECTION_TILE =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]";

type SummaryItem = { icon: LucideIcon; label: string; body: string; href: string };

// Summary panel doubles as the on-this-page contents strip: each row jumps to
// its section anchor.
const SUMMARY: readonly SummaryItem[] = [
  { icon: Check, label: "Allowed use", body: "Track signed agreements you have a right to operate on.", href: "#may-upload" },
  { icon: ShieldAlert, label: "Upload boundaries", body: "No illegal, malicious, or unauthorized regulated data.", href: "#may-not-upload" },
  { icon: Sparkles, label: "AI extraction", body: "Suggestions are source-backed and need human review.", href: "#ai-extraction" },
  { icon: Ban, label: "Prohibited conduct", body: "No access abuse, scraping, spam, or impersonation.", href: "#prohibited" },
  { icon: Flag, label: "Report concerns", body: "Flag misuse through the security channel.", href: "#reporting" },
];

const ALLOWED: readonly string[] = [
  "Vendor contracts",
  "Customer contracts",
  "Service agreements",
  "Leases",
  "Financing agreements",
  "Partnership agreements",
  "Other signed records you have a right to track",
];

const NOT_ALLOWED: readonly string[] = [
  "Illegal, infringing, or malicious content, including malware and exploit payloads",
  "Content that violates another party's rights",
  "Personal data of people who have not consented, where applicable law requires consent",
  "Medical, payment-card, or other regulated data, unless a written addendum with us covers it",
];

type Rule = { label: string; body: string };

const PROHIBITED: readonly Rule[] = [
  { label: "Access abuse", body: "Circumventing security or attempting to reach another organization's workspace." },
  { label: "Scraping and resale", body: "Scraping, mirroring, reselling, or using the product's outputs to build a competing service." },
  { label: "Unsolicited email", body: "Sending bulk unsolicited email through the reminders system." },
  { label: "Impersonation", body: "Impersonating another person or organization." },
  { label: "Automated legal decisions", body: "Making automated legal decisions about third parties." },
];

const SUSPENSION: readonly Rule[] = [
  { label: "Policy violation", body: "A workspace breaks these rules." },
  { label: "Unresolved limits or non-payment", body: "A workspace exceeds the limits included with it without resolving them, or fails to pay." },
  { label: "Security risk", body: "A workspace poses a security risk to other workspaces." },
  { label: "Legal requirement", body: "Urgent action is needed to protect users or comply with law." },
];

const RELATED: readonly { href: string; label: string }[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
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
        {/* Restrained backdrop — base wash + a faint glow, no dotted grid. */}
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-40" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-3xl px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-12">
          {/* Identity — flat inline icon-tile header, parity with sibling legal pages. */}
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <ShieldCheck className="h-5 w-5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="landing-eyebrow-dot text-[11px] font-semibold uppercase leading-none tracking-[0.22em] text-[var(--accent-strong)]">
                  Legal
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  Acceptable use
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                  Plain rules for how teams use Oblixa. They apply alongside the Terms and Privacy Policy, and
                  cover what you may upload, how AI suggestions work, and what counts as misuse.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1">
              <span className="ui-caps-2 text-[9.5px] leading-none text-[var(--text-tertiary)]">Updated</span>
              <time dateTime={LAST_REVIEWED_ISO} className="text-[11px] font-medium tabular-nums leading-none text-[var(--text-secondary)]">
                {LAST_REVIEWED_LABEL}
              </time>
            </span>
          </header>

          {/* Focal summary panel — the single raised surface; rows link to sections. */}
          <section aria-labelledby="aup-summary-h" className="mt-8">
            <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-5 sm:p-6">
              <p className="ui-caps-1 text-[10.5px] leading-none text-[var(--accent-strong)]">Summary</p>
              <h2
                id="aup-summary-h"
                className="mt-1.5 text-[1.15rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                What these rules cover
              </h2>
              <ul className={`mt-3 divide-y ${DIVIDE}`}>
                {SUMMARY.map(({ icon: Icon, label, body, href }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      <span className={SECTION_TILE} aria-hidden>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                          {label}
                        </span>
                        <span className="block text-[12px] leading-snug text-[var(--text-secondary)]">{body}</span>
                      </span>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-[var(--text-tertiary)] transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)] group-focus-visible:text-[var(--accent-strong)]"
                        strokeWidth={1.85}
                        aria-hidden
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          {/* Sections — flat, hairline-separated, icon-led. */}
          <Section id="what-oblixa-is-for" icon={FileText} title="What Oblixa is for">
            <p>
              Oblixa is a signed-contract follow-up workspace for agreements you have already signed. Teams
              use it to review key fields, assign owners, track renewal and notice dates, manage obligations,
              request evidence, and produce reports.
            </p>
            <p className="text-[13px] text-[var(--text-tertiary)]">
              Oblixa is not a law firm, a CLM drafting tool, an e-signature platform, or an autonomous
              decision-making agent.
            </p>
          </Section>

          <Section id="may-upload" icon={Upload} title="Content you may upload">
            <p>
              Upload signed agreements you have a right to track, together with the metadata, owners, dates,
              and evidence files needed to operate on them:
            </p>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {ALLOWED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                  <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" strokeWidth={2} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-[var(--text-tertiary)]">
              You are responsible for what you upload and for confirming you have the legal right to store and
              share it inside your workspace.
            </p>
          </Section>

          <Section id="may-not-upload" icon={ShieldAlert} title="Content you may not upload">
            <p>Keep these out of your workspace:</p>
            <ul className={`grid gap-2 rounded-xl border ${HAIRLINE} ${POLICY_BAND} p-4`}>
              {NOT_ALLOWED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] leading-snug text-[var(--text-secondary)]">
                  <MinusCircle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="ai-extraction" icon={Sparkles} title="AI extraction and fair use">
            <p>
              Suggested extraction is included with Core, subject to fair use. We may temporarily throttle
              extraction if one workspace runs an unusually high volume of pages relative to typical
              contract-tracking use, and we will reach out before any sustained throttling.
            </p>
            <p>
              AI suggestions are starting points: each field stays tied to its source snippet until a person
              approves it, and you remain responsible for verifying any field that drives reminders, work, or
              reports.
            </p>
          </Section>

          <Section id="account" icon={Users} title="Account responsibility">
            <p>
              Each workspace is responsible for its members&apos; actions. Admins should keep team rosters
              current, revoke access when people leave, and rotate API keys and integration credentials on
              their own schedule. We are not liable for losses from credentials shared outside your team.
            </p>
          </Section>

          <Section id="prohibited" icon={Ban} title="Prohibited uses">
            <p>Across every workspace, the following are not allowed:</p>
            <PolicyList rows={PROHIBITED} />
          </Section>

          <Section id="suspension" icon={PauseCircle} title="Suspension">
            <p>We may suspend or end access when:</p>
            <PolicyList rows={SUSPENSION} />
            <p className="text-[13px] text-[var(--text-tertiary)]">
              We give reasonable notice and a chance to remediate, except where urgent action is needed to
              protect users or comply with law.
            </p>
          </Section>

          <Section id="reporting" icon={Flag} title="Reporting concerns">
            <p>
              If you believe a workspace, member, or piece of content breaks these rules, tell us so we can
              review. We handle acceptable-use reports through the same channel as security issues.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <ActionChip verb="Security page" href="/security" />
              <ActionChip verb="Contact us" href="/contact" />
            </div>
          </Section>

          <Section id="changes" icon={RefreshCw} title="Policy changes">
            <p>
              We may update these rules over time. Material changes are shared with workspace admins, and
              continued use of Oblixa after a change means you accept the updated policy.
            </p>
          </Section>

          {/* Related policies — structured link strip. */}
          <section aria-labelledby="aup-related-h" className={`mt-8 border-t pt-5 ${HAIRLINE}`}>
            <p id="aup-related-h" className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">
              Related policies
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {RELATED.map((link) => (
                <ActionChip key={link.href} verb={link.label} href={link.href} />
              ))}
            </div>
          </section>

          {/* Legal boundary — quiet hairline note, parity with /security. */}
          <section id="legal" aria-labelledby="aup-legal-h" className={`mt-6 flex gap-3 border-t pt-5 ${HAIRLINE}`}>
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
            <div className="min-w-0">
              <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Legal note</p>
              <h2 id="aup-legal-h" className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]">
                Oblixa is not a law firm
              </h2>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
                Oblixa is not a law firm and does not provide legal advice. Your team reviews contract
                information and makes the business or legal decisions. See the{" "}
                <Link href="/terms" className="ui-link font-medium">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="ui-link font-medium">
                  privacy policy
                </Link>
                .
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

/** Icon-led legal section: accent tile + h2 + body, separated by a hairline.
 *  Mirrors the icon-row header used across the sibling legal pages. */
function Section({
  id,
  icon: Icon,
  title: sectionTitle,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-28 mt-6 border-t pt-6 ${HAIRLINE}`}>
      <div className="flex gap-4">
        <span className={SECTION_TILE} aria-hidden>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          <h2 id={`${id}-h`} className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {sectionTitle}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Compact policy rows: a caps label column on a quiet band, body on the right. */
function PolicyList({ rows }: { rows: readonly Rule[] }) {
  return (
    <ul className={`overflow-hidden rounded-xl border ${HAIRLINE} ${POLICY_BAND} divide-y ${DIVIDE}`}>
      {rows.map((rule) => (
        <li key={rule.label} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4">
          <span className="ui-caps-2 shrink-0 pt-px text-[10px] leading-none text-[var(--text-tertiary)] sm:w-44">
            {rule.label}
          </span>
          <span className="text-[13px] leading-snug text-[var(--text-secondary)]">{rule.body}</span>
        </li>
      ))}
    </ul>
  );
}
