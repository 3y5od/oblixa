import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  FileText,
  Layers,
  Sparkles,
  Users,
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
    icon: CheckCircle2,
    title: "Operational dates you trust",
    description:
      "A fixed schema built for renewals and obligations—not generic legal AI. Human review keeps reminders aligned with reality.",
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
      "Roles, invites, and a clear queue so finance and ops can share the workload without enterprise CLM overhead.",
  },
  {
    icon: Layers,
    title: "Export and bulk import",
    description:
      "CSV export for reporting and bulk import when you’re clearing a backlog—activation without the spreadsheet risk.",
  },
] as const;

const steps = [
  { n: "1", title: "Upload", body: "Add contracts individually or in bulk." },
  { n: "2", title: "Extract & review", body: "Run AI extraction, then approve fields with evidence." },
  { n: "3", title: "Track & remind", body: "Use the dashboard and email reminders on approved dates." },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-[3.75rem] max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-950">
            ContractOps
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
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Contract operations, not CLM
            </p>
            <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
              Never miss the dates that run your business
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-zinc-600 sm:text-lg">
              ContractOps helps service teams centralize agreements, approve key
              operational fields with source-backed review, and stay ahead of
              renewals and notice windows—without buying enterprise contract
              software.
            </p>
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
            <p className="mt-6 text-xs text-zinc-500">
              Upload → extract → human approve → reminders on approved data.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Everything you need to operationalize contracts
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600 sm:text-base">
              Narrow scope, high clarity: dates, obligations, and follow-through—
              not negotiation or clause intelligence.
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
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200/90 bg-surface px-6 py-12 text-center sm:px-10">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
              Ready to replace the risky spreadsheet?
            </h2>
            <p className="mt-3 text-sm text-zinc-600 sm:text-base">
              Start with your next renewal cycle—upload a contract, run extraction,
              and approve the fields that matter.
            </p>
            <Link
              href="/signup"
              className="ui-btn-primary mt-8 inline-flex px-8 py-2.5 text-sm"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/90 bg-surface px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-center text-xs text-zinc-500 sm:text-left">
            © {new Date().getFullYear()} ContractOps. Contract Operations Tracker
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
