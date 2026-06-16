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
  DashboardSectionGroup,
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
  const upcomingDeadlinesCount =
    model.topCards.find((card) => card.key === "upcoming_deadlines")?.count ?? 0;
  const headerStateItems = [
    {
      value: String(model.totalContracts),
      label: model.totalContracts === 1 ? "contract" : "contracts",
    },
    { value: String(needsReviewCount), label: "needing review" },
    {
      value: String(upcomingDeadlinesCount),
      label:
        upcomingDeadlinesCount === 1
          ? "renewal or notice date in view"
          : "renewal and notice dates in view",
    },
  ];
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
  const prioritySections: DashboardSectionKey[] = ["review_queue", "work_needing_action"];
  const monitoringSections: DashboardSectionKey[] = ["upcoming_deadlines", "recent_activity"];
  const cleanupSections: DashboardSectionKey[] = ["data_gaps"];

  return (
    <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4 pb-10">
      <CoreDashboardHeader
        title={DASHBOARD_TITLE}
        lead="Review suggested contract details, track renewal and notice dates, assign follow-up, collect evidence, and export reports."
        stateItems={headerStateItems}
        actions={
          <CoreDashboardIntakeActions
            className="flex flex-wrap items-center gap-2"
            buttonClassName="rounded-[4px] px-3.5 py-2 text-[12.5px] font-semibold"
          />
        }
      />

      <DashboardStickyToolbar totalContracts={model.totalContracts} needsReview={needsReviewCount} />
      <ImportStatusNotice status={model.importStatus} />
      <PartialDataNotice count={visiblePartialErrors.length} />
      {model.showPlanBanner ? <CoreDashboardPlanBanner /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <MetricStrip>
          {model.topCards.map((card) => (
            <TopSignal key={card.key} card={card} />
          ))}
        </MetricStrip>

        <DashboardSectionGroup
          id="dashboard-priority-work"
          eyebrow="Priority work"
          note="Work that changes what Oblixa trusts for reminders, reports, and ownership."
        >
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(22rem,5fr)]">
            {prioritySections.map((key) => {
              const section = sectionByKey.get(key);
              return section ? <DashboardSectionView key={key} section={section} /> : null;
            })}
          </div>
        </DashboardSectionGroup>

        <DashboardSectionGroup
          id="dashboard-monitoring"
          eyebrow="Monitoring"
          note="Dates entering the next 90 days and recent confirmed changes across the workspace."
        >
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(22rem,4fr)]">
            {monitoringSections.map((key) => {
              const section = sectionByKey.get(key);
              return section ? <DashboardSectionView key={key} section={section} /> : null;
            })}
          </div>
        </DashboardSectionGroup>

        <DashboardSectionGroup
          id="dashboard-cleanup"
          eyebrow="Data completeness"
          note="Owners, dates, and counterparties a contract needs before routing and reports are reliable."
        >
          {cleanupSections.map((key) => {
            const section = sectionByKey.get(key);
            return section ? <DashboardSectionView key={key} section={section} /> : null;
          })}
        </DashboardSectionGroup>
      </div>
    </div>
  );
}
