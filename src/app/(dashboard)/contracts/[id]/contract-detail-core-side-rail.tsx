import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailCoreSideRail({ model }: { model: ContractDetailPageModel }) {
  const { canEdit, canDelete, contract, ownerMembers, showContractOwnerAssignment, v10WorkItems, coreAttentionItems, markActiveBlockedReason } = model;

  return (
          <aside className="space-y-5 xl:sticky xl:top-[calc(var(--shell-topbar-h)_+_2.75rem)] xl:max-h-[calc(100dvh_-_var(--shell-topbar-h)_-_4rem)] xl:overflow-y-auto xl:overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
            <section id="ownership-record" className="ui-card-quiet scroll-mt-28 overflow-hidden">
              <D.ContractPanelHeader icon={D.UserRound} eyebrow="Record" title="Owner and status" />
              <div className="space-y-4 px-5 py-4">
                <div>
                  <p className="ui-caps-3 text-[var(--text-tertiary)]">Record facts</p>
                  <dl className="mt-2 space-y-2 text-[12.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[var(--text-tertiary)]">Contract type</dt>
                      <dd className="text-[var(--text-primary)]">{contract.contract_type || "Not set"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[var(--text-tertiary)]">Updated</dt>
                      <dd className="text-[var(--text-primary)]">
                        <D.TimeChip date={contract.updated_at} format="readable" />
                      </dd>
                    </div>
                  </dl>
                </div>
                {showContractOwnerAssignment ? (
                  <div className="border-t border-[var(--border-subtle)] pt-4">
                    <D.OwnerAssignmentForm
                      contractId={contract.id}
                      currentOwnerId={contract.owner_id}
                      currentSecondaryOwnerId={contract.secondary_owner_id ?? null}
                      members={ownerMembers}
                    />
                  </div>
                ) : null}
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <p className="ui-caps-3 text-[var(--text-tertiary)]">Status</p>
                  <div className="mt-2">
                    <D.ContractStatusTransition
                      contractId={contract.id}
                      currentStatus={contract.status}
                      canEdit={canEdit}
                      blockActivateReason={markActiveBlockedReason}
                    />
                  </div>
                </div>
                {canDelete ? (
                  <details className="group/remove border-t border-[var(--border-subtle)] pt-4">
                    <summary className="flex cursor-pointer items-center gap-1.5 rounded-md text-[11.5px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--danger-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
                      <D.ChevronRight
                        className="h-3 w-3 transition-transform group-open/remove:rotate-90"
                        strokeWidth={2}
                        aria-hidden
                      />
                      Delete this contract record
                    </summary>
                    <div className="mt-3">
                      <D.DeleteContractButton
                        contractId={contract.id}
                        contractTitle={contract.title}
                        canDelete={canDelete}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            </section>

            <D.ContractNeedsAttention items={coreAttentionItems} />

            <D.ContractLinkedWork items={v10WorkItems} contractId={contract.id} />
          </aside>
  );
}
