import { createElement } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  FileText,
  Inbox,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
import { ActionChip } from "@/components/ui/action-chip";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { TimeChip } from "@/components/ui/time-chip";
import { DASHBOARD_EMPTY_STATES } from "@/lib/dashboard/spec-strings";
import { CompactRecentContractsList } from "./dashboard-lower-recent-contracts";
import type {
  DashboardLowerObligation,
  DashboardLowerSectionsModel,
  DashboardLowerTask,
  DashboardLowerUpcomingAction,
} from "./dashboard-lower-types";

type SectionDef = {
  id: string;
  ariaId: string;
  title: string;
  icon: LucideIcon;
  count: number;
  hasRows: boolean;
  render: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
  quietLabel: string;
  srEmptyDescription: string;
};

export function DashboardLowerSections({ model }: { model: DashboardLowerSectionsModel }) {
  const {
    missingCritical,
    promoteMissingBanner,
    reviewQueueContracts,
    recentReviewStats,
    upcomingActions,
    myTasks,
    myObligations,
    dataGapsContracts,
    activityItems,
    activityContracts,
  } = model;
  const sections: SectionDef[] = [
    {
      id: "review-queue",
      ariaId: "review-queue-h",
      title: "Details to confirm",
      icon: CheckSquare,
      count: reviewQueueContracts.length,
      hasRows: reviewQueueContracts.length > 0,
      render: () => <CompactRecentContractsList contracts={reviewQueueContracts} reviewStats={recentReviewStats} />,
      renderEmpty: () => <ActionChip verb="Confirm details" href="/contracts/review" />,
      quietLabel: "Detail confirmation queue",
      srEmptyDescription: DASHBOARD_EMPTY_STATES.reviewQueue,
    },
    {
      id: "upcoming-deadlines",
      ariaId: "upcoming-deadlines-h",
      title: "Upcoming deadlines",
      icon: CalendarClock,
      count: upcomingActions.length,
      hasRows: upcomingActions.length > 0,
      render: () => <UpcomingDeadlineSection upcomingActions={upcomingActions} />,
      renderEmpty: () => <ActionChip verb="Create reminder" href="/renewals" />,
      quietLabel: "Upcoming deadlines",
      srEmptyDescription: DASHBOARD_EMPTY_STATES.upcomingDeadlines,
    },
    {
      id: "work-needing-action",
      ariaId: "work-needing-action-h",
      title: "Tasks needing action",
      icon: ListChecks,
      count: myTasks.length + myObligations.length,
      hasRows: myTasks.length > 0 || myObligations.length > 0,
      render: () => <WorkNeedingActionSection tasks={myTasks} obligations={myObligations} />,
      renderEmpty: () => <ActionChip verb="Open tasks" href="/work" />,
      quietLabel: "Tasks needing action",
      srEmptyDescription: DASHBOARD_EMPTY_STATES.workNeedingAction,
    },
    {
      id: "data-gaps",
      ariaId: "data-gaps-h",
      title: "Missing data",
      icon: Inbox,
      count: dataGapsContracts.length,
      hasRows: dataGapsContracts.length > 0 && !promoteMissingBanner,
      render: () => <MissingFieldsSection contracts={dataGapsContracts} />,
      renderEmpty: () => <ActionChip verb="Fix missing data" href="/contracts/review" tone="warning" />,
      quietLabel: "Missing data",
      srEmptyDescription: DASHBOARD_EMPTY_STATES.dataGaps,
    },
    {
      id: "recent-activity",
      ariaId: "recent-activity-h",
      title: "Recent activity",
      icon: FileText,
      count: activityItems.length || activityContracts.length,
      hasRows: activityItems.length > 0 || activityContracts.length > 0,
      render: () =>
        activityItems.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] px-4 py-3">
            <ActivityFeed items={activityItems} />
          </div>
        ) : (
          <CompactRecentContractsList contracts={activityContracts} reviewStats={recentReviewStats} />
        ),
      renderEmpty: () => <ActionChip verb="View all" href="/contracts" />,
      quietLabel: "Recent activity",
      srEmptyDescription: DASHBOARD_EMPTY_STATES.recentActivity,
    },
  ];

  return (
    <>
      {promoteMissingBanner ? <MissingFieldsSection contracts={missingCritical} /> : null}
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <DashboardLowerSection key={section.id} section={section} />
        ))}
      </div>
    </>
  );
}

function DashboardLowerSection({ section }: { section: SectionDef }) {
  return (
    <section aria-labelledby={section.ariaId} className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id={section.ariaId} className="inline-flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
          {createElement(section.icon, {
            className: "h-4 w-4 text-[var(--accent-strong)]",
            strokeWidth: 1.85,
            "aria-hidden": true,
          })}
          {section.title}
          {section.hasRows ? (
            <span className="ml-1 inline-flex h-5 items-center rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_18%,var(--surface-raised))] px-1.5 text-[10.5px] font-semibold tabular-nums leading-none text-[var(--warning-ink)]">
              {section.count}
            </span>
          ) : null}
        </h2>
        {section.hasRows ? section.renderEmpty() : null}
      </div>
      {section.hasRows ? section.render() : <DashboardLowerEmptySection section={section} />}
    </section>
  );
}

function DashboardLowerEmptySection({ section }: { section: SectionDef }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] px-4 py-2.5">
      <Check className="h-3.5 w-3.5 shrink-0 text-[color:color-mix(in_oklab,var(--success-ink)_70%,transparent)]" strokeWidth={2.4} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">
        {emptyLabelFor(section.quietLabel)}
      </span>
      <span className="hidden text-[11.5px] text-[var(--text-tertiary)] sm:inline">
        {section.srEmptyDescription}
      </span>
    </div>
  );
}

function emptyLabelFor(label: string): string {
  if (label === "Detail confirmation queue") return "All details confirmed";
  if (label === "Upcoming deadlines") return "No deadlines in the next 90 days";
  if (label === "Tasks needing action") return "No tasks assigned to you";
  if (label === "Missing data") return "All critical details complete";
  return "No recent activity yet";
}

function UpcomingDeadlineSection({
  upcomingActions,
}: {
  upcomingActions: DashboardLowerUpcomingAction[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
        {upcomingActions.slice(0, 5).map((action) => (
          <UpcomingDeadlineRow key={`${action.contract.id}-${action.field.id}`} action={action} />
        ))}
      </ul>
      <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
        <MiniCalendar
          markers={upcomingActions
            .filter((action) => action.field.field_value)
            .map((action) => ({
              date: action.field.field_value as string,
              count: 1,
              tone: action.daysUntil <= 7 ? ("warning" as const) : undefined,
            }))}
          ariaLabel="Upcoming renewal and notice dates"
        />
      </div>
    </div>
  );
}

function UpcomingDeadlineRow({ action }: { action: DashboardLowerUpcomingAction }) {
  const tone = action.daysUntil <= 7 ? "warning" : "neutral";
  const ink = tone === "warning" ? "var(--warning-ink)" : "var(--text-tertiary)";
  return (
    <li>
      <Link href={`/contracts/${action.contract.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: `color-mix(in oklab, ${ink} 24%, var(--border-card))`,
            background: `color-mix(in oklab, ${ink} 10%, var(--surface))`,
            color: ink,
          }}
        >
          <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">
            {deadlineLabelFor(action.field.field_name)}: {action.contract.title}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{deadlineDistanceLabel(action.daysUntil)}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" strokeWidth={1.85} aria-hidden />
      </Link>
    </li>
  );
}

function deadlineLabelFor(fieldName: string): string {
  if (fieldName === "renewal_date") return "Renewal";
  if (fieldName === "end_date") return "End";
  if (fieldName === "expiration_date") return "Expires";
  if (fieldName === "notice_window_starts") return "Notice opens";
  if (fieldName === "notice_window_ends") return "Notice closes";
  return fieldName.replace(/_/g, " ");
}

function deadlineDistanceLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `${daysUntil} days from now`;
}

function WorkNeedingActionSection({
  tasks,
  obligations,
}: {
  tasks: DashboardLowerTask[];
  obligations: DashboardLowerObligation[];
}) {
  const items = [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      kind: "Task" as const,
      title: task.title,
      detail: task.contracts.title,
      href: `/contracts/${task.contracts.id}#task-${task.id}`,
      due: task.due_date,
      icon: ClipboardList,
    })),
    ...obligations.map((obligation) => ({
      id: `obligation-${obligation.id}`,
      kind: "Requirement" as const,
      title: obligation.title,
      detail: obligation.contracts.title,
      href: `/contracts/${obligation.contracts.id}#obligation-${obligation.id}`,
      due: obligation.due_date,
      icon: ListChecks,
    })),
  ].slice(0, 5);

  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]">
            <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-card)] bg-[var(--surface)] text-[var(--text-tertiary)]">
              {createElement(item.icon, { className: "h-3.5 w-3.5", strokeWidth: 1.85 })}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">
                <span>{item.kind}</span>
                <span className="mx-1.5" aria-hidden>-</span>
                <span>{item.detail}</span>
              </p>
            </div>
            {item.due ? <TimeChip date={item.due} format="readable" /> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
