import type { ReactNode } from "react";
import { Link2 } from "lucide-react";
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

// §54 ledger section headers. The urgency bands read as strong ruled register
// dividers, not a quiet caps line: the first band (notice within 30 days) is the
// active-risk register and leads with an oxblood rail + tinted field so the
// reader's eye lands on the deadlines that demand action; the unconfirmed band
// carries amber, and the calmer bands stay neutral with a strong gray rail. Each
// pairs its label with a count token + object noun ("N contracts") so the band is
// a true count-semantic header, not a bare number.
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
  const active = group === "notice_30";
  const attention = group === "notice_30" || group === "unconfirmed";
  const railColor = active
    ? "var(--danger-ink)"
    : attention
      ? "var(--warning-ink)"
      : "var(--border-strong)";
  const labelColor = active
    ? "var(--danger-ink)"
    : attention
      ? "var(--warning-ink)"
      : "var(--text-secondary)";
  return (
    <div
      className="sticky top-9 z-[5] flex items-center gap-2.5 border-b border-[color:color-mix(in_oklab,var(--border-strong)_55%,var(--border-subtle))] py-2 pl-5 pr-5"
      style={{
        background: active
          ? "color-mix(in oklab, var(--danger-soft) 24%, var(--surface-raised))"
          : attention
            ? "color-mix(in oklab, var(--warning-soft) 22%, var(--surface-raised))"
            : "color-mix(in oklab, var(--surface-muted) 94%, var(--surface-raised))",
        boxShadow: `inset 4px 0 0 0 ${railColor}`,
      }}
    >
      <span
        className="ui-caps-2 text-[11px]"
        style={{ color: labelColor }}
      >
        {label}
      </span>
      <span
        aria-hidden
        className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full border px-1.5 py-px text-[10.5px] font-semibold tabular-nums"
        style={{
          borderColor: `color-mix(in oklab, ${railColor} 30%, var(--border-subtle))`,
          color: attention ? labelColor : "var(--text-secondary)",
          background: "color-mix(in oklab, var(--surface-raised) 85%, transparent)",
        }}
      >
        {count}
      </span>
      <span className="text-[11px] text-[var(--text-tertiary)]">
        {count === 1 ? "contract" : "contracts"}
      </span>
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
        prominent
        chained={row.noticeDateIsComputed}
      />
      <RenewalFact label={RENEWAL_ROW_LABELS.owner} pane edge="start">
        <RenewalOwnerCell row={row} />
      </RenewalFact>
      <RenewalFact label={RENEWAL_ROW_LABELS.status} pane>
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
  // The column header doubles as the register masthead. The owner / status /
  // next-action labels carry the same cool inspection wash + hairline rule each
  // row's disposition band does, so the header announces the two halves every row
  // holds: a warm record + date chain on the left, the cool disposition cluster
  // on the right. Per-cell panes keep alignment locked to the pinned six-column
  // template (no stripe that could drift off the column edges).
  return (
    <div className="sticky top-0 z-10 hidden border-b border-[color:color-mix(in_oklab,var(--border-strong)_60%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-muted)_96%,var(--surface-raised))] px-5 py-3 xl:flex xl:items-stretch xl:gap-3">
      <span aria-hidden className="w-6 shrink-0" />
      {/* The grid keeps LEDGER_GRID's xl:items-start; the disposition header
          cells opt into self-stretch (in COLUMN_PANE_BASE) so their wash fills
          the masthead band height without overriding the shared template. */}
      <div className={`flex-1 ${LEDGER_GRID}`}>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.contract}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.renewalDate}</RenewalColumnLabel>
        {/* The notice deadline is the action-driving date in this ledger, so its
            column header leads the date chain — emphasized ink and a leading
            chain glyph that ties it to the renewal date to its left. */}
        <RenewalColumnLabel lead>{RENEWAL_ROW_LABELS.noticeDate}</RenewalColumnLabel>
        <RenewalColumnLabel pane="start">{RENEWAL_ROW_LABELS.owner}</RenewalColumnLabel>
        <RenewalColumnLabel pane="mid">{RENEWAL_ROW_LABELS.status}</RenewalColumnLabel>
        <RenewalColumnLabel align="right" pane="end">{RENEWAL_ROW_LABELS.nextAction}</RenewalColumnLabel>
      </div>
    </div>
  );
}

// Literal pane classes (no interpolation) so the Tailwind JIT statically sees the
// arbitrary color-mix values. The disposition wash + hairline rule match the row
// band exactly; -my-3/py-3 fill the header's py-3 so the band runs edge to edge.
const COLUMN_PANE_BASE =
  "-my-3 self-stretch border-y border-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-cool)_46%,var(--surface-raised))] px-2.5 py-3";
const COLUMN_PANE: Record<"start" | "mid" | "end", string> = {
  start: `${COLUMN_PANE_BASE} rounded-l-[5px] border-l border-l-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))]`,
  mid: COLUMN_PANE_BASE,
  end: `${COLUMN_PANE_BASE} rounded-r-[5px] border-r border-r-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))]`,
};

function RenewalColumnLabel({
  children,
  align = "left",
  lead = false,
  pane,
}: {
  children: ReactNode;
  align?: "left" | "right";
  lead?: boolean;
  /** Render on the disposition wash, matching the row band; position rounds the
   *  open ("start") / close ("end") ends. */
  pane?: "start" | "mid" | "end";
}) {
  return (
    <p
      className={`inline-flex items-center gap-1 text-[10.5px] ${
        lead
          ? "ui-caps-1 text-[10.5px] text-[var(--text-primary)]"
          : "ui-caps-2 text-[var(--text-tertiary)]"
      } ${align === "right" ? "justify-end text-right" : ""} ${pane ? COLUMN_PANE[pane] : ""}`.trim()}
    >
      {lead ? (
        <Link2 className="h-3 w-3 shrink-0 text-[var(--calculated-ink)]" strokeWidth={2.25} aria-hidden />
      ) : null}
      {children}
    </p>
  );
}
