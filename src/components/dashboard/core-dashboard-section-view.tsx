import type { ReactNode } from "react";
import { ActivityRows, DataGapBoard } from "@/components/dashboard/core-dashboard-sections";
import type { CoreDashboardModel, CoreDashboardSection, DashboardSectionKey } from "@/lib/dashboard/core-dashboard-model";
import { DeadlineRows } from "./core-dashboard-deadline-rows";
import { EmptySectionRow, SectionShell } from "./core-dashboard-primitives";
import { ReviewRows } from "./core-dashboard-review-rows";
import { WorkRows } from "./core-dashboard-work-rows";

function SectionBody({ section }: { section: CoreDashboardSection }) {
  if (section.rows.length === 0) return <EmptySectionRow>{section.emptyState}</EmptySectionRow>;
  if (section.key === "review_queue") return <ReviewRows rows={section.rows} />;
  if (section.key === "upcoming_deadlines") return <DeadlineRows rows={section.rows} />;
  if (section.key === "work_needing_action") return <WorkRows rows={section.rows} />;
  if (section.key === "data_gaps") return <DataGapBoard categories={section.categories} summary={section.summary} />;
  return <ActivityRows rows={section.rows} />;
}

export function DashboardSectionView({ section }: { section: CoreDashboardSection }) {
  return (
    <SectionShell section={section}>
      <SectionBody section={section} />
    </SectionShell>
  );
}

export function DashboardSectionGroup({
  id,
  eyebrow,
  note,
  children,
}: {
  id: string;
  eyebrow: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-2.5 px-0.5">
        <div className="flex items-baseline gap-3">
          <h2 id={id} className="ui-caps-2 shrink-0 text-[11px] text-[var(--text-secondary)]">
            {eyebrow}
          </h2>
          <span aria-hidden className="h-px flex-1 translate-y-[-2px] bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]" />
        </div>
        {note ? <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-secondary)]">{note}</p> : null}
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
