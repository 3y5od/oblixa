import Link from "next/link";
import { X } from "lucide-react";
import { buildWorkHref } from "@/lib/work/model";
import type { loadWorkPageModel } from "@/lib/work/model";
import { WORK_FILTER_LABELS } from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkOption } from "@/lib/work/types";

type WorkModel = Awaited<ReturnType<typeof loadWorkPageModel>>;

export function WorkQuickFilterChip({
  text,
  description,
  value,
  tone,
  active,
  href,
}: {
  text: string;
  description: string;
  value: number;
  tone?: "danger" | "warning";
  active: boolean;
  href: string;
}) {
  if (value === 0) {
    return null;
  }

  const ink =
    tone === "danger"
      ? "var(--danger-ink)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : "var(--text-secondary)";
  const remainder = text.replace(`${value} `, "");

  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      aria-label={`${active ? "Clear filter:" : "Filter:"} ${text}. ${description}`}
      title={description}
      className="ui-chip-focus inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium leading-none transition-[background-color,border-color,box-shadow,transform] hover:brightness-[1.04] active:translate-y-px"
      style={{
        borderColor: `color-mix(in oklab, ${ink} ${active ? "55%" : "30%"}, var(--border-card))`,
        background: `color-mix(in oklab, ${ink} ${active ? "20%" : "10%"}, var(--surface-raised))`,
        color: ink,
        boxShadow: active ? `inset 0 0 0 1px color-mix(in oklab, ${ink} 38%, transparent)` : undefined,
      }}
    >
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{remainder}</span>
    </Link>
  );
}

export function ActiveWorkFilterChipList({ model }: { model: WorkModel }) {
  const chips = activeFilterChips(model);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Filters</span>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.removeHref}
          aria-label={`Remove ${chip.label} filter`}
          className="ui-active-filter-chip ui-chip-focus max-w-[16rem]"
        >
          <span className="ui-caps-3 text-[9.5px] text-[color:color-mix(in_oklab,var(--accent-strong)_72%,transparent)]">
            {chip.label}
          </span>
          <span className="truncate">{chip.value}</span>
          <span className="ui-active-filter-chip-remove" aria-hidden>
            <X className="h-3 w-3" strokeWidth={2} />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function activeFilterChips(model: WorkModel) {
  const filters = model.filters;
  const lookup = (options: WorkOption[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const chips: { key: keyof WorkFilterState; label: string; value: string; removeHref: string }[] = [];
  const add = (key: keyof WorkFilterState, label: string, options: WorkOption[], value: string) => {
    if (!value) return;
    chips.push({
      key,
      label,
      value: lookup(options, value),
      removeHref: buildWorkHref({
        tab: model.activeTab,
        filters: { ...filters, [key]: "" } as WorkFilterState,
        sort: model.sort,
      }),
    });
  };
  add("owner", WORK_FILTER_LABELS.owner, model.filterOptions.owners, filters.owner);
  add("dueDate", WORK_FILTER_LABELS.dueDate, model.filterOptions.dueDates, filters.dueDate);
  add("contract", WORK_FILTER_LABELS.contract, model.filterOptions.contracts, filters.contract);
  add("status", WORK_FILTER_LABELS.status, model.filterOptions.statuses, filters.status);
  add("type", WORK_FILTER_LABELS.type, model.filterOptions.types, filters.type);
  return chips;
}
