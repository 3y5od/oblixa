import type React from "react";
import { CheckCircle2 } from "lucide-react";
import {
  PHASE_DESCRIPTIONS,
  type Phase,
  type ProductSection,
} from "@/components/landing/product-sections-data";
import { previewStageTier } from "@/components/landing/landing-layout-classes";

export function Eyebrow({ index, children }: { index?: string; children: React.ReactNode }) {
  return (
    <p className="lp-eyebrow">
      {index ? <span className="lp-eyebrow-index">{index}</span> : null}
      {children}
    </p>
  );
}

function MetricTag({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-[3px] border border-[var(--border-strong)] text-[11px] leading-none">
      <span className="bg-[var(--surface-muted)] px-2 py-1.5 font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {label}
      </span>
      <span className="bg-[var(--surface-raised)] px-2 py-1.5 font-mono font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </span>
  );
}

function Bullets({ section }: { section: ProductSection }) {
  return (
    <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {section.bullets.map((b) => (
        <li
          key={b}
          className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]"
        >
          {section.bulletVariant === "check" ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
              strokeWidth={2}
              aria-hidden
            />
          ) : (
            <span
              aria-hidden
              className="mt-[0.5rem] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-strong)]"
            />
          )}
          {b}
        </li>
      ))}
    </ul>
  );
}

export function StageCopy({ section }: { section: ProductSection }) {
  const headingId = `${section.id}-h`;
  return (
    <div className="min-w-0">
      <Eyebrow index={section.number.padStart(2, "0")}>{section.eyebrow}</Eyebrow>
      <h3
        id={headingId}
        className="lp-serif mt-3 text-[1.5rem] leading-[1.2] text-[var(--text-primary)] sm:text-[1.7rem]"
      >
        {section.title}
      </h3>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.62] text-[var(--text-secondary)]">
        {section.message}
      </p>
      {section.metric ? (
        <div className="mt-3.5">
          <MetricTag label={section.metric.label} value={section.metric.value} />
        </div>
      ) : null}
      <Bullets section={section} />
    </div>
  );
}

export function PhaseHeader({ phase }: { phase: Phase }) {
  return (
    <div className="border-t border-[var(--border-strong)] pt-7">
      <p className="lp-eyebrow">Phase {phase.number}</p>
      <h2 className="lp-serif mt-3 text-[1.7rem] leading-[1.12] text-[var(--text-primary)] sm:text-[2rem]">
        {phase.label}
      </h2>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.6] text-[var(--text-secondary)]">
        {PHASE_DESCRIPTIONS[phase.id]}
      </p>
    </div>
  );
}

export function PairedStage({
  section,
  artifact,
}: {
  section: ProductSection;
  artifact: React.ReactNode;
}) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-h`}
      tabIndex={-1}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 outline-none lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)] lg:gap-9"
      style={{ scrollMarginTop: "132px" }}
    >
      <StageCopy section={section} />
      <div className={previewStageTier}>{artifact}</div>
    </section>
  );
}

export function CopyStage({ section }: { section: ProductSection }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-h`}
      tabIndex={-1}
      className="outline-none"
      style={{ scrollMarginTop: "132px" }}
    >
      <StageCopy section={section} />
    </section>
  );
}
