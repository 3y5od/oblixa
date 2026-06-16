import {
  features,
  steps,
} from "@/components/landing/landing-page-model";
import {
  previewPrimaryTier,
  previewStageTier,
  sectionStd,
} from "@/components/landing/landing-layout-classes";
import {
  ContractsPreview,
  DetailsReviewPreview,
  AttentionMiniPreview,
  InspectionPreview,
} from "@/components/landing/landing-preview-scenes";
import { SectionEyebrow, SectionHeading } from "./landing-section-helpers";

export function HowItWorksSection() {
  const previews = [ContractsPreview, DetailsReviewPreview, AttentionMiniPreview];
  return (
    <section id="how-it-works" className={`lp-band-workflow relative scroll-mt-24 ${sectionStd}`} aria-labelledby="how-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="02">Contract follow-up</SectionEyebrow>
          <SectionHeading id="how-heading" major>From contract spreadsheet to contract tracking workspace</SectionHeading>
          <p className="mt-4 text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            Three stages from upload to action - no consultants, no implementation program, no rebuilding the tracker from scratch.
          </p>
        </div>
        <ol className="mt-8">
          {steps.map((step, index) => {
            const Preview = previews[index];
            return (
              <li key={step.n} className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 pb-8 last:pb-0 lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)] lg:gap-8">
                <div className="min-w-0 lg:pt-2">
                  <div className="flex items-baseline gap-3">
                    <span className="w-7 shrink-0 font-mono text-[12px] font-bold tabular-nums text-[var(--danger-ink)]">
                      {step.n.padStart(2, "0")}
                    </span>
                    <h3 className="text-[1.3rem] font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-[1.45rem]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 pl-10 text-[14.5px] leading-[1.6] text-[var(--text-secondary)]">{step.body}</p>
                </div>
                <div className={`${previewStageTier} lg:h-[25rem]`}>{Preview ? <Preview /> : null}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionStd}`} aria-labelledby="capabilities-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="03">Capabilities</SectionEyebrow>
          <SectionHeading id="capabilities-heading">Purpose-built for contract tracking</SectionHeading>
          <p className="mt-4 text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            Confirmed dates, owned tasks, exportable reports - the follow-up your team runs every week.
          </p>
        </div>
        <div className={`${previewPrimaryTier} mt-8`}>
          <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
            Your team confirms the date before it is used.
          </p>
          <InspectionPreview />
        </div>
        <div className="mt-9 grid gap-x-12 border-t border-[var(--border-strong)] sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-10">
          {features.map((feature, index) => (
            <div key={feature.title} className="border-b border-[var(--border-subtle)] py-3.5 sm:border-b-0 sm:py-4">
              <p className="flex items-baseline gap-2.5 font-mono text-[10.5px] font-bold tabular-nums text-[var(--text-tertiary)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--text-secondary)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
