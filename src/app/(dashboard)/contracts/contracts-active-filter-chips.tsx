import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { buildContractsListHref } from "@/lib/contracts-search-url";
import type { ContractsPageModel } from "./contracts-page-model";

export function ContractsActiveFilterChips({ model }: { model: ContractsPageModel }) {
  const { searchParams, baseParams, activeStatusLabel, members, activeFilterCount } = model;
  if (activeFilterCount === 0) return null;
  return (
    <div role="group" aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
      {searchParams.search ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, search: undefined, status: searchParams.status })}
          ariaLabel={`Remove filter: Search ${searchParams.search}`}
        >
          Search: {searchParams.search}
        </FilterChip>
      ) : null}
      {activeStatusLabel ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: undefined })}
          ariaLabel={`Remove filter: Status ${activeStatusLabel}`}
        >
          Status: {activeStatusLabel}
        </FilterChip>
      ) : null}
      {searchParams.region ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, region: undefined })}
          ariaLabel={`Remove filter: Region ${searchParams.region}`}
        >
          Region: {searchParams.region}
        </FilterChip>
      ) : null}
      {searchParams.owner ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, owner: undefined })}
          ariaLabel="Remove filter: Owner"
        >
          Owner: {members.find((m) => m.id === searchParams.owner)?.label ?? "Selected"}
        </FilterChip>
      ) : null}
      {searchParams.counterparty ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, counterparty: undefined })}
          ariaLabel={`Remove filter: Counterparty ${searchParams.counterparty}`}
        >
          Counterparty: {searchParams.counterparty}
        </FilterChip>
      ) : null}
      {searchParams.contract_type ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, contract_type: undefined })}
          ariaLabel={`Remove filter: Contract type ${searchParams.contract_type}`}
        >
          Type: {searchParams.contract_type}
        </FilterChip>
      ) : null}
      {searchParams.deadline ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, deadline: undefined })}
          ariaLabel={`Remove filter: Date ${searchParams.deadline}`}
        >
          Date: {searchParams.deadline.replace(/_/g, " ")}
        </FilterChip>
      ) : null}
      {searchParams.sort === "created" ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, sort: undefined })}
          ariaLabel="Remove filter: Sort by recently created"
        >
          Sort: created
        </FilterChip>
      ) : null}
      {searchParams.exceptions ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, exceptions: undefined })}
          ariaLabel="Remove filter: Open problems"
        >
          Open problems
        </FilterChip>
      ) : null}
      {searchParams.review ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, review: undefined })}
          ariaLabel="Remove filter: Details to review"
        >
          Details to review
        </FilterChip>
      ) : null}
      {searchParams.data_quality ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, data_quality: undefined })}
          ariaLabel="Remove filter: Missing dates"
        >
          Missing dates
        </FilterChip>
      ) : null}
      {searchParams.evidence ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, evidence: undefined })}
          ariaLabel="Remove filter: Evidence due"
        >
          Evidence due
        </FilterChip>
      ) : null}
      {searchParams.work ? (
        <FilterChip
          href={buildContractsListHref({ ...baseParams, status: searchParams.status, work: undefined })}
          ariaLabel="Remove filter: Open tasks"
        >
          Open tasks
        </FilterChip>
      ) : null}
      {activeFilterCount >= 2 ? (
        <Link href="/contracts" className="ui-link ml-1 text-[11px]">
          Clear all
        </Link>
      ) : null}
    </div>
  );
}

function FilterChip({ href, ariaLabel, children }: { href: string; ariaLabel: string; children: ReactNode }) {
  return (
    <Link href={href} className="ui-active-filter-chip" aria-label={ariaLabel}>
      {children}
      <span className="ui-active-filter-chip-remove" aria-hidden>
        <X className="h-3 w-3" strokeWidth={2} />
      </span>
    </Link>
  );
}
