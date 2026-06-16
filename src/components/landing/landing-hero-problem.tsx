import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  heroEyebrow,
  heroSubcopy,
  problemBullets,
  problemItems,
  problemSectionTitle,
} from "@/components/landing/landing-content";
import { previewBoardTier, previewHeroTier, sectionStd } from "@/components/landing/landing-layout-classes";
import { HeroPreview, ManualTrackerMock } from "@/components/landing/landing-preview-scenes";
import { SectionEyebrow, SectionHeading } from "./landing-section-helpers";

export function HeroSection() {
  return (
    <section id="hero" className="relative isolate overflow-hidden px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="lp-container relative">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-9 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0 lg:pt-6">
            <div className="lg:border-l lg:border-[color:color-mix(in_oklab,var(--border-contrast)_55%,transparent)] lg:pl-8">
              <p className="lp-eyebrow">{heroEyebrow}</p>
              <h1 className="lp-serif mt-5 text-balance text-[2.5rem] leading-[1.06] tracking-[-0.015em] text-[var(--text-primary)] sm:text-[2.8rem] sm:leading-[1.04]">
                Track what signed contracts require next.
              </h1>
              <p className="mt-4 text-pretty text-[16px] leading-[1.72] text-[var(--text-secondary)]">
                {heroSubcopy}
              </p>
            </div>
            <div className="lg:pl-8">
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                <LandingCta href="/request-access" primary label={ctaPrimaryLabel} />
                <LandingCta href="/product" label={ctaSecondaryLabel} />
              </div>
              <p className="mt-3 max-w-md text-[13px] leading-snug text-[var(--text-tertiary)]">
                Post-signature tracking - not e-signature, not legal advice, not a full CLM.
              </p>
            </div>
          </div>
          <div className={previewHeroTier}>
            <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
              Oblixa found a 60-day notice window in the signed contract.
            </p>
            <HeroPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingCta({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link href={href} prefetch={href === "/product" ? false : undefined} className={`${primary ? "ui-btn-primary" : "ui-btn-secondary"} group inline-flex items-center justify-center gap-1.5 whitespace-nowrap`}>
      {label}
      <ArrowRight className={`${primary ? "h-4 w-4" : "h-3.5 w-3.5 opacity-60"} transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none`} aria-hidden />
    </Link>
  );
}

export function ProblemSection() {
  return (
    <section id="problem" className={`lp-band-paper relative scroll-mt-24 ${sectionStd}`} aria-labelledby="problem-heading">
      <span aria-hidden className="lp-grain" />
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="01">The problem</SectionEyebrow>
          <SectionHeading id="problem-heading" major>{problemSectionTitle}</SectionHeading>
        </div>
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] items-start gap-x-14 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,39rem)]">
          <ul className="lp-rule-strong">
            {problemItems.map((item, index) => (
              <li key={item.title} className="lp-rule-item flex items-baseline gap-4 py-4">
                <span className="w-7 shrink-0 font-mono text-[13.5px] font-bold tabular-nums text-[var(--danger-ink)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[17px] font-semibold leading-[1.35] tracking-tight text-[var(--text-primary)]">{item.title}</h3>
                  <p className="mt-1 text-[14px] leading-[1.55] text-[var(--text-secondary)]">{item.description}</p>
                </div>
                <span aria-hidden className="w-12 shrink-0 self-center text-right font-mono text-[10.5px] font-bold tracking-[0.08em] text-[var(--text-tertiary)]">
                  {item.tag}
                </span>
              </li>
            ))}
          </ul>
          <div className={`${previewBoardTier} lg:sticky lg:top-24`}>
            <ManualTrackerMock />
          </div>
        </div>
        <div aria-hidden className="mt-7 grid items-center gap-x-4 gap-y-2 border-t border-[var(--border-strong)] pt-5 sm:grid-cols-[auto_minmax(1.5rem,1fr)_auto_minmax(1.5rem,1fr)_auto]">
          <span className="inline-flex h-9 items-center self-center rounded-[3px] border border-dashed border-[var(--border-contrast)] bg-[var(--surface-raised)] px-3 text-[13px] font-medium text-[var(--text-secondary)]">
            Manual tracking
          </span>
          <span className="hidden h-px bg-[var(--border-contrast)] sm:block" />
          <span className="hidden h-7 w-7 items-center justify-center self-center rounded-[3px] border border-[var(--border-contrast)] bg-[var(--surface-raised)] font-mono text-[14px] leading-none text-[var(--text-secondary)] sm:inline-flex">
            {"\u2192"}
          </span>
          <span className="hidden h-px bg-[var(--border-contrast)] sm:block" />
          <span className="inline-flex h-9 items-center self-center rounded-[3px] border border-[color:color-mix(in_oklab,var(--accent-strong)_45%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_50%,var(--surface-raised))] px-3 text-[13px] font-semibold text-[var(--text-primary)]">
            Confirmed contract information
          </span>
        </div>
        <span aria-hidden className="sr-only">{problemBullets.join(" - ")}</span>
      </div>
    </section>
  );
}
