import { Fragment } from "react";
import {
  outcomesBullets,
  outcomesSectionTitle,
} from "@/components/landing/landing-content";
import {
  compareColumns,
  compareRows,
} from "@/components/landing/landing-page-model";
import {
  previewHeroTier,
  sectionCompact,
} from "@/components/landing/landing-layout-classes";
import { AttentionPreview } from "@/components/landing/landing-preview-scenes";
import { SectionEyebrow, SectionHeading } from "./landing-section-helpers";

export function OutcomesSection() {
  return (
    <section id="outcomes" className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`} aria-labelledby="outcomes-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="04">Outcomes</SectionEyebrow>
          <SectionHeading id="outcomes-heading" major>{outcomesSectionTitle}</SectionHeading>
        </div>
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)]">
          <div className="min-w-0 lg:pt-1">
            <p className="lp-serif text-[1.6rem] leading-[1.4] text-[var(--text-primary)] sm:text-[1.75rem]">
              Signed agreement
              <span className="mt-1.5 flex items-baseline gap-2.5"><span aria-hidden className="shrink-0 font-mono text-[1rem] text-[var(--text-tertiary)]">{"\u2192"}</span>confirmed dates</span>
              <span className="mt-1.5 flex items-baseline gap-2.5"><span aria-hidden className="shrink-0 font-mono text-[1rem] text-[var(--text-tertiary)]">{"\u2192"}</span>accountable follow-up.</span>
            </p>
            <p className="mt-5 max-w-[17rem] border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4 text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
              Reminders, tasks, and reports all run from the same confirmed dates.
            </p>
          </div>
          <div className={previewHeroTier}>
            <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
              Confirmed dates create reminders, tasks, and reports.
            </p>
            <AttentionPreview />
          </div>
        </div>
        <span aria-hidden className="sr-only">{outcomesBullets.join(" - ")}</span>
      </div>
    </section>
  );
}

export function CompareSection() {
  const oblixaCellClass = "border-l-[3px] border-[color:color-mix(in_oklab,var(--accent-strong)_70%,var(--border-contrast))] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,transparent)]";
  return (
    <section id="compare" className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`} aria-labelledby="compare-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionHeading id="compare-heading" className="!mt-0">
            Spreadsheets, heavy suites, and a contract tracking workspace
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            Oblixa sits between the spreadsheet and a heavy contract suite - post-signature tracking where every date is shown with the contract clause it came from, with audit history and no months-long implementation.
          </p>
        </div>
        <div className="mt-5">
          <div aria-hidden className="lp-frame-rule" />
          <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] pb-2.5 pt-4">
            <span className="lp-serif text-[1.5rem] leading-snug text-[var(--text-primary)]">
              How Oblixa compares with spreadsheets and full contract suites
            </span>
          </div>
          <DesktopCompareTable oblixaCellClass={oblixaCellClass} />
          <MobileCompareList />
        </div>
      </div>
    </section>
  );
}

function DesktopCompareTable({ oblixaCellClass }: { oblixaCellClass: string }) {
  return (
    <div className="hidden border-b border-[var(--border-strong)] md:block">
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1.25fr]">
        <div className="flex items-center py-3 pr-5" style={{ borderBottom: "1px solid var(--border-strong)" }}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">Dimension</span>
        </div>
        {compareColumns.map((column, index) => (
          <div key={column} className={`flex items-center px-5 py-3 ${index === 2 ? oblixaCellClass : ""}`} style={{ borderBottom: "1px solid var(--border-strong)" }}>
            <span className={`font-bold uppercase ${index === 2 ? "text-[12.5px] tracking-[0.13em] text-[var(--accent-strong)]" : "text-[12px] tracking-[0.12em] text-[var(--text-primary)]"}`}>
              {column}
            </span>
          </div>
        ))}
        {compareRows.map((row) => (
          <Fragment key={row.label}>
            <div className="border-t border-[var(--border-subtle)] py-3 pr-5">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">{row.label}</p>
            </div>
            {row.cells.map((cell, index) => (
              <div key={`${row.label}-${compareColumns[index]}`} className={`flex items-center border-t border-[var(--border-subtle)] px-5 py-3 ${index === 2 ? oblixaCellClass : ""}`}>
                <span className={`text-[14px] leading-snug ${index === 2 ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                  {cell}
                </span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function MobileCompareList() {
  return (
    <ul className="md:hidden">
      {compareRows.map((row) => (
        <li key={row.label} className="lp-rule-item py-4">
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">{row.label}</p>
          <ul className="mt-2.5 space-y-2">
            {row.cells.map((cell, index) => (
              <li key={`${row.label}-m-${compareColumns[index]}`} className={index === 2 ? "border-l-2 border-[var(--border-contrast)] pl-2.5" : ""}>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  <span className={`font-medium ${index === 2 ? "font-semibold" : ""} text-[var(--text-primary)]`}>{compareColumns[index]}</span>
                  {" - "}
                  <span className={index === 2 ? "font-medium text-[var(--text-primary)]" : ""}>{cell}</span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
