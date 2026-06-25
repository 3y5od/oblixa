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
  // Compressed queue header: the count statement and the condition filters ride
  // one quiet muted band so the panel reads as subordinate chrome and the queue
  // becomes the first important object (top-panel compression). The count anchors
  // the left; condition chips sit on a ruled subregion to its right.
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-strong)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)] px-5 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 id="work-surface-title" className="ui-caps-2 text-[11px] text-[var(--text-secondary)]">
            Active tasks
          </h2>
          {/* Operational-statement count: the number is embedded in the object
              + condition sentence rather than a bare KPI figure (§19). */}
          <span
            className="inline-flex items-baseline gap-1.5 text-[13px] text-[var(--text-secondary)]"
            aria-label={`${model.totalVisibleRows} active ${model.totalVisibleRows === 1 ? "task" : "tasks"}`}
          >
            <span className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">
              {model.totalVisibleRows}
            </span>
            <span>active {model.totalVisibleRows === 1 ? "task" : "tasks"}</span>
          </span>
        </div>
        <span aria-hidden className="hidden h-5 w-px shrink-0 bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)] sm:block" />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          {/* Definitions live on each chip's hover/focus tooltip + aria-label
              (WorkQuickFilterChip), matching the Contracts condition strip — no
              separate prose definition wall. */}
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
            Condition filters
          </span>
          <WorkQuickFilters model={model} />
        </div>
      </div>
      <Link
        href="/contracts"
        className="ui-btn-ghost inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[12px]"
      >
        Open contracts
        <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </Link>
    </div>
  );
}

export function WorkViewTabs({ model }: { model: WorkModel }) {
  return (
    <div className="pt-1">
      {/* Label + helper ride one compact inline row so the tab strip starts
          higher and the queue gains vertical room (top-panel compression). The
          helper is quiet supporting copy, subordinate to the tab strip below. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-5">
        <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">Views</span>
        <span className="text-[11px] text-[var(--text-tertiary)]">
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
      // Amber, not oxblood: past due is serious but a tier below cannot-proceed,
      // so the strip reserves danger ink for the one genuinely-blocked condition
      // (red-rebalance — keeps the count strip from reading all-red).
      tone: "warning",
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
