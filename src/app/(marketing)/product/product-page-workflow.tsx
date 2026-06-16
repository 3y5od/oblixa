import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ProductAnchorNav } from "@/components/landing/product-anchor-nav";
import {
  PHASES,
  PRODUCT_SECTIONS,
  type ProductSection,
} from "@/components/landing/product-sections-data";
import {
  EvidenceRequestPreview,
  ReportsExportPreview,
  ReviewFieldsPreview,
  UpcomingDatesPreview,
  WorkQueuePreview,
} from "@/components/landing/product-mocks";
import {
  sectionCompact,
  sectionStd,
} from "@/components/landing/landing-layout-classes";
import {
  CopyStage,
  Eyebrow,
  PairedStage,
  PhaseHeader,
} from "@/app/(marketing)/product/product-page-shared";

const ARTIFACTS: Record<string, React.ReactNode> = {
  review: <ReviewFieldsPreview />,
  dates: <UpcomingDatesPreview />,
  work: <WorkQueuePreview />,
  evidence: <EvidenceRequestPreview />,
  reports: <ReportsExportPreview />,
};

function at(id: string): ProductSection {
  return PRODUCT_SECTIONS.find((section) => section.id === id)!;
}

export function ProductWorkflowSections() {
  return (
    <>
      <div className="lp-container px-4 sm:px-6">
        <ProductAnchorNav />
      </div>
      <div className={`lp-container ${sectionStd} space-y-9`}>
        <PhaseHeader phase={PHASES[0]} />
        <CopyStage section={at("replace")} />
        <CopyStage section={at("upload")} />
        <PhaseHeader phase={PHASES[1]} />
        <PairedStage section={at("review")} artifact={ARTIFACTS.review} />
        <PairedStage section={at("dates")} artifact={ARTIFACTS.dates} />
        <PairedStage section={at("work")} artifact={ARTIFACTS.work} />
        <PhaseHeader phase={PHASES[2]} />
        <PairedStage section={at("evidence")} artifact={ARTIFACTS.evidence} />
        <PairedStage section={at("reports")} artifact={ARTIFACTS.reports} />
      </div>
    </>
  );
}

export function ClosingSection() {
  return (
    <section className={`lp-band-mist relative ${sectionCompact}`} aria-labelledby="product-cta-heading">
      <div className="lp-container relative max-w-3xl">
        <Eyebrow>Start now</Eyebrow>
        <h2 id="product-cta-heading" className="lp-serif mt-3 text-balance text-[2.1rem] leading-[1.08] text-[var(--text-primary)] sm:text-[2.5rem]">
          Start tracking your signed-contract follow-up this quarter.
        </h2>
        <div className="mt-5 inline-flex flex-wrap divide-x divide-[var(--border-strong)] overflow-hidden rounded-[3px] border border-[var(--border-strong)] text-[11.5px] font-semibold text-[var(--text-secondary)]">
          <span className="px-3 py-1.5">Bounded first contract set</span>
          <span className="px-3 py-1.5">Source-backed review</span>
          <span className="px-3 py-1.5">CSV export</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/request-access"
            className="ui-btn-primary group inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            Request access
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
          <Link href="/contact" prefetch={false} className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
            Contact Oblixa
            <ArrowUpRight className="h-3.5 w-3.5 opacity-60" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
