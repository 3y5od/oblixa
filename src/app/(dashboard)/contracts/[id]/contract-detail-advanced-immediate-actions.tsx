import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedImmediateActions({ model }: { model: ContractDetailPageModel }) {
  const { immediateActions } = model;

  return (
    <>
          {immediateActions.length > 0 ? (
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-6 sm:mt-8 sm:pt-8">
              <div className="flex flex-col gap-2">
                <p className="ui-eyebrow">Immediate actions</p>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  The highest-signal dependencies and next steps on this contract.
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {immediateActions.map((action) => (
                  <D.OperationalQueueRow
                    key={`${action.eyebrow}-${action.title}`}
                    href={action.href}
                    eyebrow={action.eyebrow}
                    title={action.title}
                    hint={action.hint}
                    actionLabel={action.actionLabel}
                    tone={action.tone}
                  />
                ))}
              </div>
            </div>
          ) : null}
    </>
  );
}
