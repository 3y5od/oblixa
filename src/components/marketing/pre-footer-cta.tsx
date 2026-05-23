import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { CornerAnchor } from "@/components/ui/corner-anchor";
import { GradientPhrase } from "@/components/ui/gradient-phrase";
import { SectionOrb } from "@/components/ui/section-orb";

export interface PreFooterCtaProps {
  /** Wedge phrase used as the GradientPhrase inside the h2. */
  wedge: string;
  /** Optional trailing text after the wedge (e.g., a period). */
  trailing?: string;
  /** Leading text before the wedge (e.g., "Start the "). */
  leading?: string;
  primary: { label: string; href: string };
  tertiary?: { label: string; href: string };
}

/**
 * Pre-footer CTA band. Mirrors the pricing v10 closing-CTA chrome so the
 * site reads as having a single coherent "ready to start" surface.
 *
 * Voice-rule compliance: no helper sub-sentence next to the primary CTA
 * (memory: feedback_no_small_plain_text). The eyebrow + h2 + tertiary chevron
 * link carry the act-now context.
 */
export function PreFooterCta({
  leading = "Start the ",
  wedge,
  trailing = ".",
  primary,
  tertiary,
}: PreFooterCtaProps) {
  return (
    <section
      aria-labelledby="pre-footer-cta-heading"
      className="landing-card-premium relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-3xl border p-8 text-center sm:mt-16 sm:p-12 lg:p-14"
    >
      <CornerAnchor size="section" position="top-right" />
      <SectionOrb tone="success" size="28rem" position={{ top: "-4rem", left: "50%", transform: "translateX(-50%)" }} />
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
          Ready to start
        </p>
        <h2
          id="pre-footer-cta-heading"
          className="mt-3 text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[2.75rem] md:text-[3.25rem]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {leading}
          <GradientPhrase>{wedge}</GradientPhrase>
          {trailing}
        </h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primary.href}
            className="product-cta-halo ui-btn-primary inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 text-[14px] font-semibold"
          >
            {primary.label}
            <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
          </Link>
          {tertiary ? (
            <Link
              href={tertiary.href}
              prefetch={false}
              className="ui-link inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {tertiary.label}
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
