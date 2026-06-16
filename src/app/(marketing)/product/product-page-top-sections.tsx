import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  DashboardOverviewPreview,
} from "@/components/landing/product-mocks";
import {
  previewHeroTier,
  sectionCompact,
  sectionStd,
} from "@/components/landing/landing-layout-classes";
import { Eyebrow } from "@/app/(marketing)/product/product-page-shared";

const BEFORE_ROWS = [
  { name: "Northstar Services MSA", owner: "—" },
  { name: "Brightline Vendor Agreement", owner: "—" },
  { name: "Summit Office Lease", owner: "—" },
] as const;

const AFTER_ROWS = [
  { name: "Northstar Services MSA", owner: "PR", date: "Mar 12" },
  { name: "Brightline Vendor Agreement", owner: "MD", date: "May 20" },
  { name: "Summit Office Lease", owner: "TK", date: "Jun 02" },
] as const;

const MILESTONES = [
  { step: "First upload or import", example: "Upload 5–10 agreements or import your tracker" },
  { step: "First confirmed detail", example: "Confirm a renewal date against its source clause" },
  { step: "First owner or date reviewed", example: "Assign an owner, or confirm a date" },
  { step: "First report preview", example: "Preview the upcoming-renewals report" },
] as const;

export function HeroSection() {
  return (
    <section id="hero" className={`relative isolate overflow-hidden ${sectionStd}`}>
      <div className="lp-container relative">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-9 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0 lg:pt-6">
            <div className="lg:border-l lg:border-[color:color-mix(in_oklab,var(--border-contrast)_55%,transparent)] lg:pl-8">
              <Eyebrow>Product tour</Eyebrow>
              <h1 className="lp-serif mt-5 text-balance text-[2.4rem] leading-[1.05] tracking-[-0.015em] text-[var(--text-primary)] sm:text-[2.95rem] sm:leading-[1.03]">
                From signed contract to accountable follow-up.
              </h1>
              <p className="mt-4 text-pretty text-[16px] leading-[1.7] text-[var(--text-secondary)]">
                Upload signed contracts or import your tracker, confirm the suggested contract
                details, assign owners and dates, then track tasks, evidence, and reports.
              </p>
            </div>
            <div className="lg:pl-8">
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href="/request-access"
                  className="ui-btn-primary group inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  Request access
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/pricing"
                  prefetch={false}
                  className="ui-btn-secondary inline-flex items-center justify-center whitespace-nowrap"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </div>
          <div className={previewHeroTier}>
            <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
              The dashboard shows contracts needing review, upcoming dates, tasks, problems, and
              evidence requests.
            </p>
            <DashboardOverviewPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

export function TransformationSection() {
  return (
    <section className={`lp-band-paper relative ${sectionCompact}`} aria-labelledby="transform-heading">
      <span aria-hidden className="lp-grain" />
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <Eyebrow index="01">Before and after</Eyebrow>
          <h2 id="transform-heading" className="lp-serif mt-3 text-balance text-[1.95rem] leading-[1.1] text-[var(--text-primary)] sm:text-[2.3rem]">
            From contract spreadsheet to a tracking workspace
          </h2>
        </div>
        <div className="mt-7 grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
          <BeforePanel />
          <div aria-hidden className="hidden items-center justify-center self-center sm:flex">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] border border-[var(--border-contrast)] bg-[var(--surface-raised)] font-mono text-[14px] leading-none text-[var(--text-secondary)]">
              →
            </span>
          </div>
          <AfterPanel />
        </div>
      </div>
    </section>
  );
}

function BeforePanel() {
  return (
    <div className="rounded-[3px] border border-dashed border-[var(--border-contrast)] bg-[color:color-mix(in_oklab,var(--surface-inset)_50%,var(--surface-raised))] p-4">
      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Before</p>
      <p className="mt-1 text-[14.5px] font-semibold text-[var(--text-primary)]">
        Contract tracking spreadsheet
      </p>
      <div className="mt-3 overflow-hidden rounded-[2px] border border-[var(--border-subtle)]">
        <div className="grid grid-cols-[1fr_auto] gap-x-2 bg-[var(--surface-muted)] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <span>Contract</span>
          <span>Owner</span>
        </div>
        {BEFORE_ROWS.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-[1fr_auto] items-center gap-x-2 border-t border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px]"
          >
            <span className="truncate text-[var(--text-secondary)]">{row.name}</span>
            <span className="font-mono text-[var(--text-tertiary)]">{row.owner}</span>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
        <li>Owners filled in once, never updated</li>
        <li>Renewal dates scattered across tabs</li>
        <li>No source for clause text</li>
      </ul>
    </div>
  );
}

function AfterPanel() {
  return (
    <div className="lp-artifact p-4">
      <p className="ui-caps-2 text-[10px] text-[var(--accent-strong)]">After</p>
      <p className="mt-1 text-[14.5px] font-semibold text-[var(--text-primary)]">
        Oblixa contract tracking workspace
      </p>
      <div className="mt-3 overflow-hidden rounded-[2px] border border-[var(--border-subtle)]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 bg-[var(--surface-muted)] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <span>Contract</span>
          <span>Owner</span>
          <span>Renewal</span>
        </div>
        {AFTER_ROWS.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-t border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px]"
          >
            <span className="truncate text-[var(--text-primary)]">{row.name}</span>
            <span className="inline-flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-contrast)] font-mono text-[8.5px] font-bold text-[var(--text-secondary)]">
              {row.owner}
            </span>
            <span className="font-mono tabular-nums text-[var(--text-tertiary)]">{row.date}</span>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
        {[
          "Named owners on every record, kept current",
          "Renewals and notice dates in one timeline",
          "Source snippets attached to every confirmed contract detail",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]"
              strokeWidth={2}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActivationSection() {
  return (
    <section className={`relative border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`} aria-labelledby="activation-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <Eyebrow index="02">Activation path</Eyebrow>
          <h2 id="activation-heading" className="lp-serif mt-3 text-balance text-[1.95rem] leading-[1.1] text-[var(--text-primary)] sm:text-[2.3rem]">
            What the first workspace reaches, in order
          </h2>
        </div>
        <ol className="mt-6 border-b border-[var(--border-strong)] lp-rule-strong">
          {MILESTONES.map((m, i) => (
            <li key={m.step} className="lp-rule-item flex items-baseline gap-4 py-4">
              <span className="w-7 shrink-0 font-mono text-[13.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold leading-snug text-[var(--text-primary)]">{m.step}</p>
                <p className="mt-1 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]">{m.example}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
