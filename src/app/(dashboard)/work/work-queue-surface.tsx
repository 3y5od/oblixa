import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UiTabs } from "@/components/ui/ui-tabs";
import { buildWorkHref } from "@/lib/work/model";
import type { loadWorkPageModel } from "@/lib/work/model";
import type { WorkFilterState } from "@/lib/work/types";
import { WorkQuickFilterChip } from "./work-filter-chips";

type WorkModel = Awaited<ReturnType<typeof loadWorkPageModel>>;

const WORK_QUICK_FILTER_EMPTY: WorkFilterState = {
  owner: "",
  dueDate: "",
  contract: "",
  status: "",
  type: "",
};

export function WorkQueueOverview({ model }: { model: WorkModel }) {
  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 id="work-surface-title" className="ui-caps-2 text-[var(--text-secondary)]">
              Active tasks
            </h2>
            <span
              className="inline-flex items-baseline gap-1.5 text-[12.5px] text-[var(--text-secondary)]"
              aria-label={`${model.totalVisibleRows} active ${model.totalVisibleRows === 1 ? "task" : "tasks"}`}
            >
              <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                {model.totalVisibleRows}
              </span>
              <span>active {model.totalVisibleRows === 1 ? "task" : "tasks"}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Condition filters</span>
            <WorkQuickFilters model={model} />
          </div>
          <p className="mt-1.5 max-w-[52rem] text-[12.5px] leading-5 text-[var(--text-secondary)]">
            Active tasks are open follow-up items linked to signed contracts. Condition filters show matching task
            counts and narrow the table when selected.
          </p>
          <p
            className="mt-1 max-w-[62rem] text-[12px] leading-5 text-[var(--text-tertiary)]"
            aria-label="Condition filter definitions"
          >
            <span className="font-semibold text-[var(--text-secondary)]">Cannot proceed:</span> answer,
            approval, file, or owner is missing.{" "}
            <span className="font-semibold text-[var(--text-secondary)]">Past due:</span> due date has
            passed.{" "}
            <span className="font-semibold text-[var(--text-secondary)]">Due within 7 days:</span> due
            today or this week.{" "}
            <span className="font-semibold text-[var(--text-secondary)]">Unassigned:</span> no owner is
            assigned.
          </p>
        </div>
        <Link
          href="/contracts"
          className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
        >
          Open contracts
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function WorkViewTabs({ model }: { model: WorkModel }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 pt-3">
        <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Views</span>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          Choose the row category shown below. Counts reflect the active filters.
        </span>
      </div>
      <UiTabs
        ariaLabel="Task table views"
        items={model.tabs.map((tab) => ({
          href: tab.href,
          label: tab.label,
          active: tab.active,
          count: tab.count,
          countTone:
            (tab.key === "overdue" || tab.key === "blocked") && tab.count === 0
              ? ("success" as const)
              : undefined,
        }))}
        className="px-5"
      />
    </div>
  );
}

function WorkQuickFilters({ model }: { model: WorkModel }) {
  const { summary, filters, activeTab, sort } = model;
  const plural = (n: number) => (n === 1 ? "task" : "tasks");
  const items: {
    key: string;
    text: string;
    description: string;
    value: number;
    tone?: "danger" | "warning";
    active: boolean;
    href: string;
  }[] = [
    {
      key: "blocked",
      text: `${summary.blocked} ${plural(summary.blocked)} cannot proceed`,
      description: "Answer, approval, file, or owner is missing.",
      value: summary.blocked,
      tone: "danger",
      active: activeTab === "blocked",
      href: buildWorkHref({ tab: activeTab === "blocked" ? "all" : "blocked", sort }),
    },
    {
      key: "overdue",
      text: `${summary.overdue} ${plural(summary.overdue)} past due`,
      description: "Due date has passed.",
      value: summary.overdue,
      tone: "danger",
      active: activeTab === "overdue",
      href: buildWorkHref({ tab: activeTab === "overdue" ? "all" : "overdue", sort }),
    },
    {
      key: "dueSoon",
      text: `${summary.dueSoon} ${plural(summary.dueSoon)} due within 7 days`,
      description: "Due today or within the next 7 days.",
      value: summary.dueSoon,
      tone: "warning",
      active: filters.dueDate === "due_soon",
      href: buildWorkHref({
        tab: "all",
        filters: { ...WORK_QUICK_FILTER_EMPTY, dueDate: filters.dueDate === "due_soon" ? "" : "due_soon" },
        sort,
      }),
    },
    {
      key: "unassigned",
      text: `${summary.unassigned} unassigned ${plural(summary.unassigned)}`,
      description: "No owner is assigned.",
      value: summary.unassigned,
      active: filters.owner === "unassigned",
      href: buildWorkHref({
        tab: "all",
        filters: { ...WORK_QUICK_FILTER_EMPTY, owner: filters.owner === "unassigned" ? "" : "unassigned" },
        sort,
      }),
    },
  ];

  if (items.every((item) => item.value === 0)) {
    return (
      <span className="text-[12px] font-medium text-[var(--success-ink)]">
        No condition filters need attention.
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Task condition filters">
      {items.map(({ key, ...chip }) => (
        <WorkQuickFilterChip key={key} {...chip} />
      ))}
    </div>
  );
}
