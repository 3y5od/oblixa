import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedHeroHeader({ model }: { model: ContractDetailPageModel }) {
  const { canEdit, showContractWorkflowOps, contract, upcomingReminders, isWatchlisted, pendingFieldsCount, filesCount, fieldsCount, backHref, backLabel, operationsStrip, visibleV10HeaderCards } = model;
  const iconByKey: Record<D.ContractDetailIconKey, typeof D.User> = {
    owner: D.User,
    nextAction: D.FileText,
    reminders: D.Bell,
    freshness: D.Calendar,
  };
  const accentClassByKey = {
    primary: "text-[var(--text-primary)]",
    attention: "text-[var(--warning-ink)]",
    secondary: "text-[var(--text-secondary)]",
  } as const;

  return (
    <>
          <D.Link
            href={backHref}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
          >
            <D.ArrowLeft size={16} strokeWidth={1.85} aria-hidden />
            {backLabel}
          </D.Link>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Agreement</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="max-w-3xl text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">{contract.title}</h1>
                <span
                  className={`ui-badge shrink-0 ${
                    D.STATUS_STYLES[contract.status as keyof typeof D.STATUS_STYLES]
                  }`}
                >
                  {D.STATUS_LABELS[contract.status as keyof typeof D.STATUS_LABELS]}
                </span>
              </div>
              {(contract.counterparty || contract.contract_type) && (
                <p className="mt-3 text-[14px] text-[var(--text-secondary)] md:text-[14px]">
                  {contract.counterparty && (
                    <span className="font-medium text-[var(--text-primary)]">{contract.counterparty}</span>
                  )}
                  {contract.counterparty && contract.contract_type && (
                    <span className="text-[var(--text-tertiary)]"> · </span>
                  )}
                  {contract.contract_type && (
                    <span className="text-[var(--text-secondary)]">{contract.contract_type}</span>
                  )}
                </p>
              )}
              <section className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] p-4">
                <p className="ui-eyebrow">Record header</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {visibleV10HeaderCards.map((card) => (
                    <D.Link
                      key={card.label}
                      href={card.href}
                      data-v10-surface="contract_record"
                      data-v10-section="record_header"
                      data-v10-action={card.label}
                      data-v10-source-object={card.sourceObject}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm hover:border-[var(--accent)]"
                    >
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {card.label}
                      </span>
                      <span className="mt-1 block font-medium text-[var(--text-primary)]">{card.value}</span>
                    </D.Link>
                  ))}
                </div>
              </section>
              {canEdit && showContractWorkflowOps && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isWatchlisted ? (
                    <form action={D.removeWatchlistEntry.bind(null, contract.id)}>
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Remove from watchlist
                      </button>
                    </form>
                  ) : (
                    <form action={D.upsertWatchlistEntryForm} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input aria-label="team key" name="teamKey"
                        defaultValue="ops"
                        placeholder="team key"
                        maxLength={80}
                        className="ui-input-compact h-8 w-28 text-xs"
                      />
                      <input aria-label="why watch?" name="note"
                        placeholder="why watch?"
                        maxLength={240}
                        className="ui-input-compact h-8 w-56 text-xs"
                      />
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Add to watchlist
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {operationsStrip.map((item) => {
              const Icon = iconByKey[item.icon];
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,var(--surface-raised))] px-4 py-3 shadow-[var(--shadow-1)]"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_76%,transparent)] p-2 text-[var(--text-tertiary)]">
                      <Icon size={14} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {item.label}
                      </p>
                      <p className={`mt-1 text-[12.5px] leading-relaxed ${accentClassByKey[item.accent]}`}>{item.value}</p>
                      {item.footerHref && item.footerLabel ? (
                        <div className="mt-1">
                          <D.Link
                            href={item.footerHref}
                            className="text-[12.5px] font-medium text-[var(--text-link)] underline underline-offset-2"
                          >
                            {item.footerLabel}
                          </D.Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <D.ContractHeroMetrics
            contractId={contract.id}
            pendingFieldsCount={pendingFieldsCount}
            fieldsCount={fieldsCount}
            filesCount={filesCount}
            upcomingRemindersCount={upcomingReminders.length}
          />
    </>
  );
}
