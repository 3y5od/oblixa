import Link from "next/link";
import { ContractTable } from "@/components/contracts/contract-table";
import { DataFooter } from "@/components/ui/data-footer";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { buildContractsListHref } from "@/lib/contracts-search-url";
import type { ContractsPageModel } from "./contracts-page-model";

export function ContractsTableSection({ model }: { model: ContractsPageModel }) {
  return (
    <section className="min-w-0">
      {model.contractsPageError ? (
        <RecoverableState
          state="failed"
          title="Contracts could not be loaded"
          reason="The contract list query failed, so this is not being shown as an empty contract list."
          accessibleName="Contracts list failed state"
          nextActionLabel="Retry contracts"
          nextAction={
            <Link href="/contracts" className="ui-link">
              Retry contracts
            </Link>
          }
        />
      ) : (
        <ContractTable
          contracts={model.contracts}
          reviewStats={model.reviewStats}
          rowSignals={model.rowSignals}
          filterFingerprint={model.filterFingerprint}
          emptyState={
            model.activeFilterCount > 0 || model.sanitizedSearch
              ? {
                  title: "No contracts match these filters",
                  copy: "Clear the filters or search terms to return to the full contract list.",
                  actionHref: "/contracts",
                  actionLabel: "Clear filters",
                }
              : undefined
          }
          bulkActions={{
            canEdit: model.canEdit,
            orgId: model.orgId,
            members: model.members,
          }}
          footer={
            model.contractTotal > 0 ? (
              <DataFooter
                shown={model.contracts.length}
                total={model.contractTotal}
                countLabel="Showing"
                countSeparator="of"
                sectionLabel="contracts"
                pagination={{
                  page: model.page,
                  totalPages: model.listTotalPages,
                  hrefFor: (p) =>
                    buildContractsListHref({
                      ...model.paginationQuery,
                      page: p > 1 ? String(p) : undefined,
                    }),
                  showFirstLast: model.listTotalPages > 2,
                }}
              />
            ) : undefined
          }
        />
      )}
    </section>
  );
}
