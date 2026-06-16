import {
  antiGoalSummary,
  bestFitItems,
  bestFitSectionTitle,
  faqItems,
} from "@/components/landing/landing-content";
import {
  bestFitProofs,
  boundaryBlockTitles,
  faqCategories,
} from "@/components/landing/landing-page-model";
import {
  previewStageTier,
  sectionCompact,
  sectionStd,
} from "@/components/landing/landing-layout-classes";
import { FirstSetPreview } from "@/components/landing/landing-preview-scenes";
import { SectionEyebrow, SectionHeading } from "./landing-section-helpers";

export function BestFitSection() {
  return (
    <section id="best-fit" className={`lp-band-mist relative scroll-mt-24 ${sectionCompact}`} aria-labelledby="best-fit-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="05">Best fit</SectionEyebrow>
          <SectionHeading id="best-fit-heading">{bestFitSectionTitle}</SectionHeading>
        </div>
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
          <ul className="border-b border-[var(--border-subtle)]">
            {bestFitItems.map((item, index) => {
              const last = index === bestFitItems.length - 1;
              return (
                <li key={item} className="lp-rule-item flex items-baseline gap-4 py-4">
                  <span className="w-7 shrink-0 font-mono text-[13.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`leading-[1.5] text-[var(--text-primary)] ${last ? "text-[16px] font-semibold" : "text-[15.5px]"}`}>
                      {item}
                    </p>
                    <p className="mt-1.5 font-mono text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                      {bestFitProofs[index]}
                    </p>
                  </div>
                  {last ? (
                    <span className="shrink-0 self-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                      Good first set
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className={previewStageTier}>
            <FirstSetPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function BoundaryBlock({
  kicker,
  title,
  body,
  accent,
}: {
  kicker: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="lp-rule-item relative py-3 pl-4 first:border-t-0">
      <span aria-hidden className="absolute left-0 top-[1.1rem] h-5 w-[2px]" style={{ background: accent }} />
      <p className="flex items-baseline gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.13em]" style={{ color: accent }}>
        <span aria-hidden className="font-mono text-[10.5px] font-semibold">{"\u00a7"}</span>
        {kicker}
      </p>
      <h3 className="mt-1.5 text-[16.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-[1.62] text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

export function TrustSection() {
  const featured = faqItems.filter((item) => item.featured);
  const rest = faqItems.filter((item) => !item.featured);
  const [clmBoundary, ...boundaryItems] = featured;

  return (
    <section id="objections" className={`lp-band-paper relative scroll-mt-24 ${sectionStd}`} aria-labelledby="objections-heading">
      <span aria-hidden className="lp-grain" />
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="06">Trust</SectionEyebrow>
          <SectionHeading id="objections-heading">Scope and data boundaries</SectionHeading>
        </div>
        <div className="mt-3.5 max-w-3xl border-l-2 border-[var(--border-contrast)] pl-4">
          <p className="flex items-baseline gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--text-secondary)]">
            <span aria-hidden className="font-mono text-[10.5px] font-semibold">{"\u00a7"}</span>
            Operating boundary
          </p>
          <p className="mt-1 text-[14.5px] leading-[1.55] text-[var(--text-secondary)]">{antiGoalSummary}</p>
          {clmBoundary ? (
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--text-tertiary)]">
              <span className="font-semibold text-[var(--text-secondary)]">{clmBoundary.question}</span>{" "}
              {clmBoundary.answer}
            </p>
          ) : null}
        </div>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-14 border-b border-[var(--border-subtle)] sm:grid-cols-2 sm:[&>div:nth-child(2)]:border-t-0">
          {boundaryItems.map((item, index) => (
            <BoundaryBlock
              key={item.question}
              kicker={boundaryBlockTitles[index]?.kicker ?? "Boundary"}
              title={boundaryBlockTitles[index]?.title ?? item.question}
              body={boundaryBlockTitles[index]?.summary ?? item.answer}
              accent={boundaryBlockTitles[index]?.accent ?? "var(--border-contrast)"}
            />
          ))}
        </div>
        <FaqLedger items={rest} />
      </div>
    </section>
  );
}

function FaqLedger({ items }: { items: typeof faqItems }) {
  return (
    <div id="faq" className="mt-6 scroll-mt-24">
      <div aria-hidden className="lp-frame-rule" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4">
        <h3 id="faq-heading" className="lp-serif text-[1.5rem] leading-snug text-[var(--text-primary)]">
          Frequently asked questions
        </h3>
        <span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">05 questions</span>
      </div>
      <div className="mt-3 border-b border-[var(--border-strong)]">
        {items.map((item, index) => (
          <details key={item.question} className="group lp-rule-item">
            <summary className="flex cursor-pointer list-none items-baseline gap-4 px-1 py-2 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] group-open:bg-[color:color-mix(in_oklab,var(--surface-muted)_35%,transparent)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
              <span className="w-7 shrink-0 font-mono text-[13px] font-bold tabular-nums text-[var(--text-secondary)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="hidden w-[7.5rem] shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] sm:block">
                {faqCategories[index] ?? "General"}
              </span>
              <span className="flex-1 pr-3 text-[15.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">{item.question}</span>
              <span aria-hidden className="shrink-0 font-mono text-[15.5px] text-[var(--text-secondary)]">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">-</span>
              </span>
            </summary>
            <div className="px-1 pb-4 pt-0.5 text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:pl-[11.25rem]">
              <div className="max-w-2xl border-l-2 border-[color:color-mix(in_oklab,var(--border-contrast)_55%,transparent)] pl-4">
                {item.answer}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
