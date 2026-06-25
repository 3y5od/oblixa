import { buildReportsHref } from "@/lib/reports/model";
import { REPORT_FILTER_LABELS, REPORT_WINDOW_LABELS } from "@/lib/reports/spec-strings";
import type { ReportsPageModel } from "@/lib/reports/types";

export type ActiveFilterChip = { key: string; label: string; value: string; removeHref: string };

export function buildActiveFilterChips(model: ReportsPageModel): ActiveFilterChip[] {
  const filters = model.filters;
  const applicable = new Set(model.applicableFilters);
  const chips: ActiveFilterChip[] = [];
  if (applicable.has("window") && filters.window !== "90") {
    chips.push({
      key: "window",
      label: REPORT_FILTER_LABELS.window,
      value: REPORT_WINDOW_LABELS[filters.window],
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, window: "90" } }),
    });
  }
  if (applicable.has("owner") && filters.owner) {
    chips.push({
      key: "owner",
      label: REPORT_FILTER_LABELS.owner,
      value: model.filterOptions.owners.find((option) => option.value === filters.owner)?.label ?? filters.owner,
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, owner: "" } }),
    });
  }
  if (applicable.has("counterparty") && filters.counterparty) {
    chips.push({
      key: "counterparty",
      label: REPORT_FILTER_LABELS.counterparty,
      value: filters.counterparty,
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, counterparty: "" } }),
    });
  }
  if (applicable.has("status") && filters.status) {
    chips.push({
      key: "status",
      label: REPORT_FILTER_LABELS.status,
      value: model.filterOptions.statuses.find((option) => option.value === filters.status)?.label ?? filters.status,
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, status: "" } }),
    });
  }
  return chips;
}
