"use client";

import { useRouter } from "next/navigation";
import { UiSelect } from "@/components/ui/ui-select";
import { buildWorkHref } from "@/lib/work/model";
import type { WorkFilterState, WorkOption, WorkPageModel, WorkSortKey } from "@/lib/work/types";

/**
 * Sort applies live (no Apply): selecting a key navigates immediately with the
 * new sort, preserving the active tab + filters and resetting to the first page
 * (buildWorkHref drops `page` when it isn't passed).
 */
export function WorkSortSelect({
  sort,
  options,
  activeTab,
  filters,
}: {
  sort: WorkSortKey;
  options: WorkOption[];
  activeTab: WorkPageModel["activeTab"];
  filters: WorkFilterState;
}) {
  const router = useRouter();
  return (
    <UiSelect
      variant="pill"
      label="Sort"
      value={sort}
      options={options}
      ariaLabel="Sort work"
      buttonClassName="h-10"
      menuWidth="fit"
      portal
      onChange={(value) =>
        router.push(buildWorkHref({ tab: activeTab, filters, sort: value as WorkSortKey }))
      }
    />
  );
}
