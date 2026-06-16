import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailCoreHeader({ model }: { model: ContractDetailPageModel }) {
  const { contract, pendingFieldsCount, backHref, backLabel, creationNotice, ownerLabel, openExceptionsCount, hasActiveIssues, coreTabLinks, activeTab, hasSourceFiles, hasExtractedFields, missingCoreDateCount, activeEvidenceCount, openWorkCount, reviewCompleteness, coreTabBadgeCounts, nextReviewedDate, noticeWindowShort, primaryActionHref, primaryActionLabel, coreReviewSignal, coreDateSignal } = model;

  return (
    <>
        {creationNotice ? (
          <div className={creationNotice.tone === "success" ? "ui-alert-success" : "ui-alert-warning"}>
            <p className="font-semibold">{creationNotice.title}</p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed">
              {creationNotice.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
              <D.Link href="#extracted-fields" className="ui-link">
                Open suggested details
              </D.Link>
              <D.Link href="#source-documents" className="ui-link">
                Check source documents
              </D.Link>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <D.Link
            href={backHref}
            className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
          >
            <D.ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {backLabel}
          </D.Link>
          <D.DashboardPageHeader
            icon={<D.FileText className="h-4 w-4" strokeWidth={1.85} />}
            eyebrow="Contract record"
            title={contract.title}
            density="compact"
            metaStrip={
              <>
                {contract.counterparty ? (
                  <div>
                    <dt className="ui-caps-3 text-[var(--text-tertiary)]">Counterparty</dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{contract.counterparty}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Owner</dt>
                  <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{ownerLabel ?? "Unassigned"}</dd>
                </div>
                {reviewCompleteness ? (
                  <div>
                    <dt className="ui-caps-3 text-[var(--text-tertiary)]">Confirmed</dt>
                    <dd className="mt-0.5">
                      <D.RatioChip
                        numerator={reviewCompleteness.approved}
                        denominator={reviewCompleteness.total}
                        tone={reviewCompleteness.approved >= reviewCompleteness.total ? "success" : undefined}
                      />
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Open tasks</dt>
                  <dd className="mt-0.5">
                    {openWorkCount > 0 ? (
                      <D.Link href={`/work?contract=${model.id}`} className="inline-flex">
                        <D.CountChip value={openWorkCount} emphasis="strong" />
                      </D.Link>
                    ) : (
                      <D.CountChip value={0} />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Next date</dt>
                  <dd className="mt-0.5">
                    {nextReviewedDate ? (
                      <D.TimeChip date={nextReviewedDate} format="calendar" />
                    ) : (
                      <span
                        className="font-medium text-[var(--text-tertiary)]"
                        title="No confirmed upcoming date yet"
                      >
                        —
                      </span>
                    )}
                  </dd>
                </div>
                {noticeWindowShort ? (
                  <div>
                    <dt className="ui-caps-3 text-[var(--text-tertiary)]">Notice</dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                      {noticeWindowShort}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Status</dt>
                  <dd className="mt-0.5">
                    <D.StatusBadge status={D.STATUS_SEMANTICS[contract.status as keyof typeof D.STATUS_SEMANTICS]}>
                      {D.STATUS_LABELS[contract.status as keyof typeof D.STATUS_LABELS]}
                    </D.StatusBadge>
                  </dd>
                </div>
              </>
            }
            actions={
              <D.Link
                href={primaryActionHref}
                className={`${hasActiveIssues ? "ui-btn-primary" : "ui-btn-secondary"} inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px]`}
              >
                {primaryActionLabel === "Attach source file" ? (
                  <D.Paperclip className="h-3 w-3" strokeWidth={2} aria-hidden />
                ) : null}
                {primaryActionLabel}
                {primaryActionLabel === "Attach source file" ? null : (
                  <D.ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
                )}
              </D.Link>
            }
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]" aria-label="Contract action summary">
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            <D.ContractSignalCell
              label="Suggested details"
              icon={D.ClipboardCheck}
              value={coreReviewSignal.value}
              unit={pendingFieldsCount > 0 ? "pending" : hasExtractedFields ? "confirmed" : hasSourceFiles ? "awaiting suggestions" : "awaiting file"}
              tone={coreReviewSignal.tone}
              href={coreReviewSignal.href}
              actionLabel={coreReviewSignal.actionLabel}
            />
            <D.ContractSignalCell
              label="Key dates"
              icon={D.CalendarClock}
              value={coreDateSignal.value}
              unit={!hasExtractedFields ? "waiting" : missingCoreDateCount > 0 ? "gaps" : "tracked"}
              tone={coreDateSignal.tone}
              href="#contract-dates"
              actionLabel={coreDateSignal.actionLabel}
            />
            <D.ContractSignalCell
              label="Issues"
              icon={D.AlertTriangle}
              value={openExceptionsCount}
              unit={openExceptionsCount > 0 ? "open" : "clear"}
              tone={openExceptionsCount > 0 ? "danger" : "healthy"}
              href={openExceptionsCount > 0 ? `/contracts/exceptions?status=open&contract=${contract.id}` : `/contracts/${contract.id}?tab=work`}
              actionLabel={openExceptionsCount > 0 ? "Triage" : undefined}
            />
            <D.ContractSignalCell
              label="Evidence"
              icon={D.FileCheck2}
              value={activeEvidenceCount}
              unit={activeEvidenceCount > 0 ? (activeEvidenceCount === 1 ? "request" : "requests") : "clear"}
              tone={activeEvidenceCount > 0 ? "attention" : "healthy"}
              href={activeEvidenceCount > 0 ? "#contract-evidence" : `/contracts/${contract.id}?tab=evidence`}
              actionLabel={activeEvidenceCount > 0 ? "Request" : undefined}
            />
          </div>
        </section>

        <nav
          aria-label="Contract detail sections"
          className="sticky top-[var(--shell-topbar-h)] z-20 flex gap-x-5 overflow-x-auto border-b border-[color:color-mix(in_oklab,var(--border-subtle)_86%,transparent)] bg-[color:color-mix(in_oklab,var(--canvas)_88%,transparent)] pt-1 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {coreTabLinks.map(([value, label]) => {
            const active = activeTab === value;
            const badge = coreTabBadgeCounts[value] ?? 0;
            const reservesBadge = value in coreTabBadgeCounts;
            return (
              <D.Link
                key={value}
                href={`/contracts/${contract.id}?tab=${value}`}
                className={`relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-2 text-[12.5px] transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  active
                    ? "border-transparent font-semibold text-[var(--accent-strong)]"
                    : "border-transparent font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {label}
                {reservesBadge ? (
                  <span className="inline-flex min-w-[1.125rem] justify-center">
                    {badge > 0 ? <D.CountChip value={badge} emphasis={active ? "strong" : "subtle"} /> : null}
                  </span>
                ) : null}
                {active ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-[-2px] h-[3px] rounded-full bg-[var(--accent)]"
                  />
                ) : null}
              </D.Link>
            );
          })}
        </nav>
    </>
  );
}
