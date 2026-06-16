import { ContractsFilterBar } from "@/components/contracts/contracts-filter-bar";
import { ContractsSavedViewsControl } from "@/components/contracts/contracts-saved-views-control";
import { ContractsActiveFilterChips } from "./contracts-active-filter-chips";
import { DEADLINE_OPTIONS, type ContractsPageModel } from "./contracts-page-model";

export function ContractsFiltersSection({ model }: { model: ContractsPageModel }) {
  const { searchParams } = model;
  return (
    <section
      aria-label="Filters"
      className="min-w-0 space-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-3"
    >
      <ContractsFilterBar
        values={{
          search: searchParams.search ?? "",
          status: searchParams.status ?? "",
          owner: searchParams.owner ?? "",
          counterparty: searchParams.counterparty ?? "",
          contract_type: searchParams.contract_type ?? "",
          region: searchParams.region ?? "",
          deadline: model.deadline,
          sort: searchParams.sort === "created" ? "created" : "activity",
          exceptions: model.exceptionsFilter,
          review: model.reviewFilter,
          data_quality: model.dataQualityFilter,
          evidence: model.evidenceFilter,
          work: model.workFilter,
          health: model.healthFilter,
        }}
        statusOptions={model.statuses}
        ownerOptions={model.members.map((m) => ({ value: m.id, label: m.label }))}
        counterpartyOptions={model.counterpartyOptions.map((c) => ({ value: c, label: c }))}
        contractTypeOptions={model.contractTypeOptions.map((c) => ({ value: c, label: c }))}
        deadlineOptions={DEADLINE_OPTIONS}
        activeFilterCount={model.activeFilterCount}
        savedViewsSlot={
          <ContractsSavedViewsControl
            savedViews={model.savedViews}
            activeSavedView={model.activeSavedView}
            orgId={model.orgId}
            canEdit={model.canEdit}
            defaults={{
              search: searchParams.search || "",
              status: searchParams.status || "",
              owner: searchParams.owner || "",
              counterparty: searchParams.counterparty || "",
              contract_type: searchParams.contract_type || "",
              region: searchParams.region || "",
              deadline: searchParams.deadline || "",
              sort: searchParams.sort || "",
              exceptions: searchParams.exceptions || "",
              review: searchParams.review || "",
              data_quality: searchParams.data_quality || "",
              evidence: searchParams.evidence || "",
              work: searchParams.work || "",
            }}
          />
        }
      />
      <ContractsActiveFilterChips model={model} />
    </section>
  );
}
