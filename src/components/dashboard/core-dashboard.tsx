import { DashboardStickyToolbar } from "@/components/dashboard/dashboard-sticky-toolbar";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import {
  CoreDashboardHeader,
  CoreDashboardIntakeActions,
  EmptyDashboard,
  ImportStatusNotice,
  PartialDataNotice,
} from "@/components/dashboard/core-dashboard-shell";
import { CoreDashboardPlanBanner } from "@/components/dashboard/core-dashboard-plan-banner";
import { TopSignal } from "@/components/dashboard/core-dashboard-primitives";
import {
  DashboardSectionView,
  getSection,
} from "@/components/dashboard/core-dashboard-section-view";
import { DASHBOARD_TITLE } from "@/lib/dashboard/spec-strings";
import {
  getCoreDashboardVisiblePartialErrors,
  type CoreDashboardModel,
  type CoreDashboardSection,
  type DashboardSectionKey,
} from "@/lib/dashboard/core-dashboard-model";

export function CoreDashboard({ model }: { model: CoreDashboardModel }) {
  if (model.totalContracts === 0) {
    return <EmptyDashboard importStatus={model.importStatus} />;
  }

  const visiblePartialErrors = getCoreDashboardVisiblePartialErrors(model.partialErrors);
  const needsReviewCount =
    model.topCards.find((card) => card.key === "needs_review")?.count ?? 0;
  const orderedSections: CoreDashboardSection[] = [
    getSection(model, "review_queue"),
    getSection(model, "work_needing_action"),
    getSection(model, "upcoming_deadlines"),
    getSection(model, "recent_activity"),
    getSection(model, "data_gaps"),
  ];
  const sectionByKey = new Map<DashboardSectionKey, CoreDashboardSection>(
    orderedSections.map((section) => [section.key, section])
  );
  // Triage information architecture (Now → Next/Blocked, then Coverage + Activity).
  // The dominant work column carries the next action (Now: review hero) and the
  // active work queue (Next/Blocked). The right rail carries supporting context:
  // date pressure + coverage gaps + activity. Section-group names are retained as
  // the placement buckets the dashboard contract expects.
  const prioritySections: DashboardSectionKey[] = ["review_queue", "work_needing_action"];
  const monitoringSections: DashboardSectionKey[] = ["upcoming_deadlines"];
  const cleanupSections: DashboardSectionKey[] = ["data_gaps"];
  const activitySection = sectionByKey.get("recent_activity");

  return (
    <div className="ui-page-stack w-full min-w-0 gap-4 pb-10">
      {/* Compact command zone: workspace identity + intake actions, then the
          snapshot cards. Kept tight so the signature review surface rises. */}
      <div className="flex flex-col gap-2.5">
        <CoreDashboardHeader
          title={DASHBOARD_TITLE}
          actions={
            <CoreDashboardIntakeActions
              className="flex flex-wrap items-center gap-2"
              buttonClassName="rounded-[4px] px-3.5 py-2 text-[12.5px] font-semibold"
            />
          }
        />
        <MetricStrip>
          {model.topCards.map((card) => (
            <TopSignal key={card.key} card={card} />
          ))}
        </MetricStrip>
      </div>

      <DashboardStickyToolbar totalContracts={model.totalContracts} needsReview={needsReviewCount} />
      <ImportStatusNotice status={model.importStatus} />
      <PartialDataNotice count={visiblePartialErrors.length} />
      {model.showPlanBanner ? <CoreDashboardPlanBanner /> : null}

      {/* Command center: dominant work column (Now → queue) + a single cohesive,
          subordinate context rail (date pressure · coverage · activity). */}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23.5rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {prioritySections.map((key) => {
            const section = sectionByKey.get(key);
            return section ? (
              <DashboardSectionView key={key} section={section} variant="main" />
            ) : null;
          })}
        </div>

        <aside
          aria-label="Dates, missing details, and recent activity"
          className="min-w-0 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] overflow-hidden rounded-[8px] border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:sticky xl:top-4"
          style={{ background: "color-mix(in oklab, var(--surface-muted) 70%, var(--surface-raised))" }}
        >
          {monitoringSections.map((key) => {
            const section = sectionByKey.get(key);
            return section ? (
              <DashboardSectionView key={key} section={section} variant="rail" />
            ) : null;
          })}
          {cleanupSections.map((key) => {
            const section = sectionByKey.get(key);
            return section ? (
              <DashboardSectionView key={key} section={section} variant="rail" />
            ) : null;
          })}
          {activitySection ? (
            <DashboardSectionView section={activitySection} variant="rail" />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
