import type { ReactNode } from "react";
import { RenewalRowDisclosure } from "@/components/renewals/renewal-row-disclosure";
import { buildRenewalsHref } from "@/lib/renewals/model";
import {
  RENEWAL_GROUP_LABELS,
  RENEWAL_ROW_LABELS,
} from "@/lib/renewals/spec-strings";
import type { RenewalGroupKey, RenewalRow, RenewalWindowKey } from "@/lib/renewals/types";
import {
  RenewalsEmptyState,
} from "./renewals-page-sections";
import {
  RenewalContractCell,
  RenewalDateCell,
  RenewalFact,
  RenewalNextActionCell,
  RenewalOwnerCell,
  RenewalStatusBadge,
  renewalNoticeBasis,
} from "./renewal-row-cells";
import { RenewalRowDetail } from "./renewal-row-detail";
import { GROUP_ORDER, LEDGER_GRID } from "./renewals-ledger-constants";
import type { RenewalFormAction, RenewalsPageModel } from "./renewals-page-types";

export function RenewalLedger({
  model,
  canMutate,
  returnTo,
  filtersActive,
  clearFiltersHref,
  updateRenewalAction,
}: {
  model: RenewalsPageModel;
  canMutate: boolean;
  returnTo: string;
  filtersActive: boolean;
  clearFiltersHref: string;
  updateRenewalAction: RenewalFormAction;
}) {
  if (model.rows.length === 0) {
    return (
      <RenewalsEmptyState
        filtersActive={filtersActive}
        hasAnyContracts={model.summary.hasAnyContracts}
        clearFiltersHref={clearFiltersHref}
        activeWindow={model.activeWindow}
        widenHref={buildRenewalsHref({ window: "180", filters: model.filters, sort: model.activeSort })}
      />
    );
  }

  const groups: { key: RenewalGroupKey; rows: RenewalRow[] }[] = model.grouped
    ? GROUP_ORDER.map((key) => ({ key, rows: model.rows.filter((row) => row.group === key) })).filter(
        (group) => group.rows.length > 0
      )
    : [{ key: "renewal_window", rows: model.rows }];

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      <div className="max-h-[60vh] max-w-full overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]">
        <RenewalLedgerHeader />
        {model.grouped
          ? groups.map((group) => (
              <div key={group.key}>
                <RenewalGroupHeader group={group.key} count={group.rows.length} activeWindow={model.activeWindow} />
                {group.rows.map((row) => (
                  <RenewalLedgerRow
                    key={row.id}
                    row={row}
                    canMutate={canMutate}
                    returnTo={returnTo}
                    activeWindow={model.activeWindow}
                    updateRenewalAction={updateRenewalAction}
                  />
                ))}
              </div>
            ))
          : model.rows.map((row) => (
              <RenewalLedgerRow
                key={row.id}
                row={row}
                canMutate={canMutate}
                returnTo={returnTo}
                activeWindow={model.activeWindow}
                updateRenewalAction={updateRenewalAction}
              />
            ))}
      </div>
    </div>
  );
}

function RenewalGroupHeader({
  group,
  count,
  activeWindow,
}: {
  group: RenewalGroupKey;
  count: number;
  activeWindow: RenewalWindowKey;
}) {
  const label =
    group === "renewal_window"
      ? RENEWAL_GROUP_LABELS.renewal_window(activeWindow)
      : group === "notice_30"
        ? RENEWAL_GROUP_LABELS.notice_30
        : group === "unconfirmed"
          ? RENEWAL_GROUP_LABELS.unconfirmed
          : RENEWAL_GROUP_LABELS.later;
  return (
    <div className="sticky top-9 z-[5] flex items-center gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--surface-raised))] px-5 py-1.5">
      <span className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[10.5px] tabular-nums text-[var(--text-tertiary)]">{count}</span>
    </div>
  );
}

function RenewalLedgerRow({
  row,
  canMutate,
  returnTo,
  activeWindow,
  updateRenewalAction,
}: {
  row: RenewalRow;
  canMutate: boolean;
  returnTo: string;
  activeWindow: RenewalWindowKey;
  updateRenewalAction: RenewalFormAction;
}) {
  const titleId = `renewal-row-${row.id}`;
  return (
    <RenewalRowDisclosure
      labelledById={titleId}
      title={row.title}
      gridClassName={LEDGER_GRID}
      detail={<RenewalRowDetail row={row} activeWindow={activeWindow} />}
    >
      <RenewalContractCell row={row} titleId={titleId} />
      <RenewalDateCell
        label={RENEWAL_ROW_LABELS.renewalDate}
        dateLabel={row.renewalDateLabel}
        days={row.daysUntilRenewal}
        review={row.renewalDateReview}
        basis={null}
      />
      <RenewalDateCell
        label={RENEWAL_ROW_LABELS.noticeDate}
        dateLabel={row.noticeDateLabel}
        days={row.daysUntilNotice}
        review={row.noticeDateReview}
        basis={row.noticeDateIsComputed ? renewalNoticeBasis(row.noticeWindowDays) : null}
      />
      <RenewalFact label={RENEWAL_ROW_LABELS.owner}>
        <RenewalOwnerCell row={row} />
      </RenewalFact>
      <RenewalFact label={RENEWAL_ROW_LABELS.status}>
        <RenewalStatusBadge row={row} />
      </RenewalFact>
      <RenewalNextActionCell
        row={row}
        canMutate={canMutate}
        returnTo={returnTo}
        updateRenewalAction={updateRenewalAction}
      />
    </RenewalRowDisclosure>
  );
}

function RenewalLedgerHeader() {
  return (
    <div className="sticky top-0 z-10 hidden border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_92%,var(--surface-raised))] px-5 py-3 xl:flex xl:items-start xl:gap-3">
      <span aria-hidden className="w-6 shrink-0" />
      <div className={`flex-1 ${LEDGER_GRID}`}>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.contract}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.renewalDate}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.noticeDate}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.owner}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.status}</RenewalColumnLabel>
        <RenewalColumnLabel align="right">{RENEWAL_ROW_LABELS.nextAction}</RenewalColumnLabel>
      </div>
    </div>
  );
}

function RenewalColumnLabel({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <p
      className={`ui-caps-2 text-[10.5px] text-[var(--text-tertiary)] ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </p>
  );
}
