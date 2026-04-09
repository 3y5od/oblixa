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

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-[3.75rem] max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-950">
            Oblixa
          </span>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Site">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign in
            </Link>
            <Link href="/signup" className="ui-btn-primary py-2 text-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <section className="border-b border-zinc-200/80 bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(30,58,95,0.09),transparent)] px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Contract operations, not CLM
              </p>
              <h1 className="mx-auto mt-5 max-w-4xl text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl md:text-[2.9rem] md:leading-[1.1]">
                Run renewals, approvals, and obligations from one trusted system
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-zinc-600 sm:text-lg">
                Oblixa gives operations teams a practical execution layer: centralize agreements,
                verify extracted fields with evidence, and execute date-driven workflows with clear ownership.
              </p>
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="ui-btn-primary min-w-[10rem] px-6 py-2.5 text-sm">
                Create free account
              </Link>
              <Link
                href="/login"
                className="ui-btn-secondary min-w-[10rem] px-6 py-2.5 text-sm"
              >
                Sign in
              </Link>
            </div>
            <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
              {valuePoints.map(({ icon: Icon, title, description }) => (
                <div key={title} className="ui-card-quiet px-4 py-4 text-left">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-700">
                    <Icon size={16} aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-zinc-500">
              Upload -&gt; extract -&gt; review -&gt; approve -&gt; automate with confidence.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Purpose-built capabilities for contract operations
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600 sm:text-base">
              Focused scope, high accountability: the critical workflows teams run weekly.
            </p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="ui-card group p-6 transition-[border-color] hover:border-zinc-300/90"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/90 text-zinc-700 transition-colors group-hover:border-indigo-200/60 group-hover:bg-indigo-50/40">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-zinc-200/80 bg-zinc-50/40 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="relative text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-surface text-sm font-bold text-zinc-900">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-zinc-200/90 bg-surface px-6 py-10 sm:px-8">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                Move your next renewal cycle into a controlled workflow
              </h2>
              <p className="mt-3 text-sm text-zinc-600 sm:text-base">
                Start with a narrow rollout: ingest active agreements, validate key fields, and
                assign ownership for upcoming milestones.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="ui-chip">Approvals</span>
                <span className="ui-chip">Exceptions</span>
                <span className="ui-chip">Obligations</span>
                <span className="ui-chip">Tasks</span>
                <span className="ui-chip">Calendar exports</span>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200/90 bg-surface px-6 py-10 text-center sm:px-8 lg:text-left">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950">
                Ready to get started?
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                Create your workspace and upload the first contract in minutes.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/signup" className="ui-btn-primary px-6 py-2.5 text-sm">
                  Create free account
                </Link>
                <Link href="/login" className="ui-btn-secondary px-6 py-2.5 text-sm">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200/80 bg-zinc-50/40 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-2xl border border-zinc-200/80 bg-white px-6 py-6 sm:px-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Trust and controls
            </h2>
            <p className="mt-3 text-sm text-zinc-600 sm:text-base">
              Role-aware access, API key controls, signed outbound webhooks, and configurable workflows help teams scale operations safely.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/90 bg-surface px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-center text-xs text-zinc-500 sm:text-left">
            © {new Date().getFullYear()} Oblixa. Contract execution platform.
            does not provide legal advice—verify terms against your originals.
          </p>
          <div className="flex gap-4 text-xs font-medium">
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
            <Link href="/signup" className="text-zinc-600 hover:text-zinc-900">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
