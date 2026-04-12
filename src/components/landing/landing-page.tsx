import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  FileText,
  Gauge,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import {
  antiGoalSummary,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  heroEyebrow,
  heroSubcopy,
  heroTitle,
  objectionBullets,
  riskReducerLine,
  trustSummary,
  useCaseItems,
  faqItems,
} from "@/components/landing/landing-content";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";

const features = [
  {
    icon: FileText,
    title: "One place for agreements",
    description:
      "Upload PDFs and DOCX files, keep the signed record organized by counterparty and type.",
  },
  {
    icon: Sparkles,
    title: "AI extraction you approve",
    description:
      "Pull renewal, notice, and term fields from the document—then approve with source snippets before anything drives reminders.",
  },
  {
    icon: ShieldCheck,
    title: "Operational data you can defend",
    description:
      "Evidence-backed field review, approval checkpoints, and audit events help teams trust every reminder and decision.",
  },
  {
    icon: Bell,
    title: "Reminders that match ownership",
    description:
      "Email reminders tied to approved dates and the right owner, so handoffs don’t strand follow-ups.",
  },
  {
    icon: Users,
    title: "Built for small teams",
    description:
      "Roles, clear queues, and focused workflows let finance, ops, and legal share responsibility without CLM complexity.",
  },
  {
    icon: Layers,
    title: "Export and bulk import",
    description:
      "CSV export for reporting and bulk import when you’re clearing a backlog—activation without the spreadsheet risk.",
  },
] as const;

const steps = [
  {
    n: "1",
    title: "Ingest",
    body: "Upload a single agreement or bulk import a backlog with owner and region context.",
  },
  {
    n: "2",
    title: "Validate",
    body: "Extract key dates, review source snippets, and approve only what your team is willing to operate on.",
  },
  {
    n: "3",
    title: "Execute",
    body: "Drive tasks, obligations, approvals, and reminders from verified data with clear ownership.",
  },
] as const;

const valuePoints = [
  {
    icon: Gauge,
    title: "Operational clarity in days",
    description:
      "Focus your first rollout on renewals, notice windows, and obligations instead of months of CLM setup.",
  },
  {
    icon: Workflow,
    title: "Workflow-first contract operations",
    description:
      "Approvals, exceptions, maintenance, and review cadence are built for recurring operational work.",
  },
  {
    icon: CheckCircle2,
    title: "Built-in controls for scale",
    description:
      "Role-based access, API key scopes, signed webhooks, and secured integrations support growth responsibly.",
  },
] as const;

const landingSectionNavClassName =
  "inline-flex min-h-9 items-center rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 no-underline transition-colors first:pl-0 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:min-h-10 sm:px-2.5";

export function LandingPage() {
  return (
    <div className="landing-root flex min-h-full flex-col bg-canvas">
      <MarketingSiteHeader
        secondaryNav={
          <>
            <a href="#capabilities" className={landingSectionNavClassName}>
              Capabilities
            </a>
            <a href="#how-it-works" className={landingSectionNavClassName}>
              How it works
            </a>
            <a href="#use-cases" className={landingSectionNavClassName}>
              Use cases
            </a>
            <a href="#trust" className={landingSectionNavClassName}>
              Trust
            </a>
            <a href="#faq" className={landingSectionNavClassName}>
              FAQ
            </a>
          </>
        }
      />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <section
          id="hero"
          className="border-b border-[var(--border-subtle)] bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(30,58,95,0.09),transparent)] px-4 py-16 sm:px-6 sm:py-24 scroll-mt-36"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                {heroEyebrow}
              </p>
              <h1 className="mx-auto mt-5 max-w-4xl text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl md:text-[2.9rem] md:leading-[1.1]">
                {heroTitle}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-zinc-600 sm:text-lg">
                {heroSubcopy}
              </p>
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="ui-btn-primary min-h-10 min-w-[10rem] px-6 py-2.5 text-sm">
                {ctaPrimaryLabel}
              </Link>
              <Link
                href="/login"
                prefetch={false}
                className="ui-btn-secondary min-h-10 min-w-[10rem] px-6 py-2.5 text-sm"
              >
                {ctaSecondaryLabel}
              </Link>
            </div>
            <p className="mt-4 text-center text-xs text-zinc-600">{riskReducerLine}</p>
            <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
              {valuePoints.map(({ icon: Icon, title, description }) => (
                <div key={title} className="ui-card-quiet px-4 py-4 text-left">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-surface text-zinc-700">
                    <Icon size={16} aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-zinc-600">
              Upload -&gt; extract -&gt; review -&gt; approve -&gt; automate with confidence.
            </p>
          </div>
        </section>

        <section
          id="capabilities"
          className="scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="capabilities-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="capabilities-heading"
              className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl"
            >
              Purpose-built capabilities for contract operations
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600 sm:text-base">
              Focused scope, high accountability: the critical workflows teams run weekly.
            </p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="ui-card group p-6 transition-[border-color] motion-safe:duration-[var(--ui-duration)] motion-safe:ease-[var(--ui-ease-out)] hover:border-zinc-300/90"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-zinc-50/90 text-zinc-700 transition-colors motion-safe:duration-[var(--ui-duration)] group-hover:border-indigo-200/60 group-hover:bg-indigo-50/40">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-36 border-y border-[var(--border-subtle)] bg-zinc-50/40 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="how-heading"
              className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl"
            >
              How it works
            </h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="relative text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-surface text-sm font-bold text-zinc-900">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="use-cases"
          className="scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="use-cases-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="use-cases-heading"
              className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl"
            >
              Use cases teams run every week
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600 sm:text-base">
              Start narrow, expand once ownership and data quality are steady.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              {useCaseItems.map((u) => (
                <li key={u.title} className="ui-card-quiet p-5">
                  <h3 className="text-sm font-semibold text-zinc-900">{u.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{u.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="objections"
          className="scroll-mt-36 border-y border-[var(--border-subtle)] bg-zinc-50/40 px-4 py-14 sm:px-6 sm:py-16"
          aria-labelledby="objections-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="objections-heading"
              className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl"
            >
              Practical answers to common concerns
            </h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              {objectionBullets.map((o) => (
                <li key={o.title} className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-5">
                  <h3 className="text-sm font-semibold text-zinc-900">{o.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{o.body}</p>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-zinc-600">{antiGoalSummary}</p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="cta-mid-heading">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface px-6 py-10 sm:px-8">
              <h2
                id="cta-mid-heading"
                className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl"
              >
                Move your next renewal cycle into a controlled workflow
              </h2>
              <p className="mt-3 text-sm text-zinc-600 sm:text-base">
                Start with a narrow rollout: ingest active agreements, validate key fields, and assign
                ownership for upcoming milestones.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="ui-chip">Approvals</span>
                <span className="ui-chip">Exceptions</span>
                <span className="ui-chip">Obligations</span>
                <span className="ui-chip">Tasks</span>
                <span className="ui-chip">Calendar exports</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface px-6 py-10 text-center sm:px-8 lg:text-left">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Ready to get started?</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Create your workspace and upload the first contract in minutes.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/signup" className="ui-btn-primary min-h-10 px-6 py-2.5 text-sm">
                  {ctaPrimaryLabel}
                </Link>
                <Link href="/login" prefetch={false} className="ui-btn-secondary min-h-10 px-6 py-2.5 text-sm">
                  {ctaSecondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          id="trust"
          className="scroll-mt-36 border-t border-[var(--border-subtle)] bg-zinc-50/40 px-4 py-10 sm:px-6"
          aria-labelledby="trust-heading"
        >
          <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--border-subtle)] bg-surface px-6 py-6 sm:px-8">
            <h2 id="trust-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Trust and controls
            </h2>
            <p className="mt-3 text-sm text-zinc-600 sm:text-base">{trustSummary}</p>
            <p className="mt-4 text-sm">
              <Link href="/security" className="ui-link font-medium text-zinc-800">
                Read the security overview
              </Link>{" "}
              <span className="text-zinc-600">for how we approach access, integrations, and reporting issues.</span>
            </p>
          </div>
        </section>

        <section
          id="faq"
          className="scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-heading" className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mt-3 text-center text-sm text-zinc-600">
              Straightforward answers about scope, AI, and how teams use Oblixa.
            </p>
            <div className="mt-10 space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-[var(--border-subtle)] bg-surface px-4 py-3 sm:px-5"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.question}
                      <span className="text-zinc-400 motion-safe:transition-transform group-open:rotate-180">▼</span>
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm leading-relaxed text-zinc-600">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          className="border-t border-[var(--border-subtle)] bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(30,58,95,0.06),transparent)] px-4 py-14 sm:px-6 sm:py-16"
          aria-labelledby="cta-final-heading"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="cta-final-heading" className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
              Start with one workspace and prove the workflow
            </h2>
            <p className="mt-3 text-sm text-zinc-600 sm:text-base">
              Upload a contract, validate the fields that matter, and assign owners for the next milestones.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="ui-btn-primary min-h-10 min-w-[10rem] px-6 py-2.5 text-sm">
                {ctaPrimaryLabel}
              </Link>
              <Link href="/login" prefetch={false} className="ui-btn-secondary min-h-10 min-w-[10rem] px-6 py-2.5 text-sm">
                {ctaSecondaryLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
