import type { ReactNode } from "react";
import { ActivityRows, DataGapBoard } from "@/components/dashboard/core-dashboard-sections";
import type { CoreDashboardModel, CoreDashboardSection, DashboardSectionKey } from "@/lib/dashboard/core-dashboard-model";
import { DeadlineRows } from "./core-dashboard-deadline-rows";
import { EmptySectionRow, SectionShell } from "./core-dashboard-primitives";
import { ReviewRows } from "./core-dashboard-review-rows";
import { WorkRows } from "./core-dashboard-work-rows";

type SectionVariant = "main" | "rail";

function SectionBody({ section, variant }: { section: CoreDashboardSection; variant: SectionVariant }) {
  const compact = variant === "rail";
  if (section.rows.length === 0) return <EmptySectionRow>{section.emptyState}</EmptySectionRow>;
  if (section.key === "review_queue") return <ReviewRows rows={section.rows} />;
  if (section.key === "upcoming_deadlines") return <DeadlineRows rows={section.rows} compact={compact} />;
  if (section.key === "work_needing_action") return <WorkRows rows={section.rows} />;
  if (section.key === "data_gaps") return <DataGapBoard categories={section.categories} compact={compact} />;
  return <ActivityRows rows={section.rows} />;
}

export function DashboardSectionView({
  section,
  variant = "main",
}: {
  section: CoreDashboardSection;
  variant?: SectionVariant;
}) {
  return (
    <SectionShell section={section} variant={variant}>
      <SectionBody section={section} variant={variant} />
    </SectionShell>
  );
}

export function DashboardSectionGroup({
  id,
  eyebrow,
  role,
  note,
  children,
}: {
  id: string;
  eyebrow: string;
  /** Short role descriptor that names what this band is for (decision queue /
   *  date watch / quality register), so the three groups read as distinct roles
   *  rather than three identical caps headers (§5 distinct section roles). */
  role?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={id} className="shrink-0 text-[1.0625rem] font-bold tracking-tight text-[var(--text-primary)]">
            {eyebrow}
          </h2>
          {role ? (
            <span className="shrink-0 text-[12px] font-medium tracking-tight text-[var(--text-tertiary)]">{role}</span>
          ) : null}
        </div>
        {note ? <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-[var(--text-tertiary)]">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function getSection(model: CoreDashboardModel, key: DashboardSectionKey): CoreDashboardSection {
  const section = model.sections.find((candidate) => candidate.key === key);
  if (!section) {
    throw new Error(`Missing Core dashboard section: ${key}`);
  }
  return section;
}
