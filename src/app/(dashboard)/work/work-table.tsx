import Link from "next/link";
import { WorkReleaseActions } from "@/components/work/work-release-actions";
import { DataFooter } from "@/components/ui/data-footer";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WORK_EMPTY_STATE, WORK_ROW_LABELS } from "@/lib/work/spec-strings";
import type { WorkItemRow, WorkPageModel } from "@/lib/work/types";
import {
  recordBlockStyle,
  rowRailStyle,
  WorkContractCell,
  WorkDue,
  WorkNextActionNote,
  WorkOwnerCell,
  WorkStatusBadge,
  WorkTypeIcon,
} from "./work-table-cells";

export function WorkTable({
  rows,
  mutationsEnabled,
  pagination,
  pageHref,
  isFiltered,
  clearHref,
}: {
  rows: WorkItemRow[];
  mutationsEnabled: boolean;
  pagination: WorkPageModel["pagination"];
  pageHref: (page: number) => string;
  isFiltered: boolean;
  clearHref: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-10">
        {isFiltered ? (
          <RecoverableState
            state="empty"
            title="No tasks in this view"
            reason="No items match the current tab and filters. Clear filters or pick another tab to see more tasks."
            accessibleName="Filtered task empty view"
            surface="work"
            section="queue"
            nextActionLabel="Clear filters"
            nextAction={
              <Link href={clearHref} className="ui-link">
                Clear filters
              </Link>
            }
          />
        ) : (
          <RecoverableState
            state="empty"
            title="No tasks yet"
            reason={WORK_EMPTY_STATE}
            accessibleName="Empty task view"
            surface="work"
            section="queue"
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-h-[calc(100dvh-20rem)] min-w-0 max-w-full overflow-x-auto overflow-y-auto [contain:inline-size] md:block">
        <table className="min-w-full text-sm" aria-label="Tasks in this workspace">
          <thead className="ui-table-header sticky top-0 z-20 [&_th]:bg-[var(--surface-muted)] [&_th]:shadow-[0_3px_6px_-3px_color-mix(in_oklab,var(--border-strong)_55%,transparent)]">
            <tr className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_45%,var(--border-subtle))] [&_th]:ui-caps-2 [&_th]:text-[11px] [&_th]:text-[var(--text-secondary)]">
              <th className="px-5 py-3">Task and next action</th>
              <th className="hidden w-[13rem] px-4 py-3 lg:table-cell">{WORK_ROW_LABELS.linkedContract}</th>
              <th className="hidden w-[9rem] px-4 py-3 md:table-cell">{WORK_ROW_LABELS.owner}</th>
              <th className="w-[9.5rem] px-4 py-3">{WORK_ROW_LABELS.dueDate}</th>
              <th className="w-[12rem] px-4 py-3">{WORK_ROW_LABELS.status}</th>
              <th className="hidden w-[6.5rem] px-4 py-3 lg:table-cell">{WORK_ROW_LABELS.lastUpdate}</th>
              <th className="w-[10.5rem] px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const titleHref = row.display.identity.title.href ?? row.href;
              const contract = row.display.identity.linkedContract;
              // The supporting columns (contract / owner / due / status) read as
              // one grouped metadata block, not four loose cells: a shared quiet
              // sheet backing + a single leading vertical rule separates the
              // record (col 1) from its supporting facts (§6 composition — related
              // values visually grouped). The cannot-proceed row's block is faintly
              // oxblood-washed so the blocked record reads as a distinct object.
              const block = recordBlockStyle(row);
              const supportCellBg = { background: block.background };
              const leadRule = block.borderColor;
              return (
                <tr key={row.key} className="ui-table-row group">
                  {/* Record cell. The oxblood left rail rides ONLY the
                      cannot-proceed tier (red-rebalance) so the genuinely blocked
                      record stays the single loudest line; past-due and routine
                      rows carry no rail. The rail rides the first cell rather than
                      the <tr> so it paints reliably under border-collapse. */}
                  <td className="px-5 py-3.5 align-top" style={rowRailStyle(row)}>
                    <div className="flex items-start gap-3">
                      <WorkTypeIcon row={row} label={row.typeLabel} />
                      <div className="min-w-0">
                        <span className="ui-caps-3 block text-[9.5px] leading-none text-[var(--text-tertiary)]">
                          {row.typeLabel}
                        </span>
                        <Link
                          href={titleHref}
                          title={row.title}
                          className="mt-1.5 block max-w-[34rem] truncate text-[14px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
                        >
                          {row.display.identity.title.value}
                        </Link>
                        <WorkNextActionNote row={row} />
                        <div className="mt-1.5 lg:hidden">
                          {contract.href ? (
                            <Link
                              href={contract.href}
                              title={contract.value}
                              className="block max-w-[24rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                            >
                              {contract.value}
                              {row.counterparty ? ` ${"·"} ${row.counterparty}` : ""}
                            </Link>
                          ) : (
                            <span className="block text-[11.5px] text-[var(--text-tertiary)]">
                              {contract.value}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Supporting metadata block (contract / owner / due / status).
                      One leading rule per breakpoint: Contract leads at lg, Owner
                      at md, Due at base. Shared sheet backing makes the four cells
                      read as a single grouped object. */}
                  <td
                    className="hidden w-[13rem] border-l px-4 py-3.5 align-top lg:table-cell"
                    style={{ ...supportCellBg, borderColor: leadRule }}
                  >
                    <WorkContractCell row={row} max="max-w-[12rem]" />
                  </td>
                  <td
                    className="hidden w-[9rem] whitespace-nowrap border-[color:var(--border-subtle)] px-4 py-3.5 align-top md:table-cell md:border-l lg:border-l-0"
                    style={{ ...supportCellBg, borderLeftColor: leadRule }}
                  >
                    <WorkOwnerCell row={row} />
                  </td>
                  <td
                    className="w-[9.5rem] border-l px-4 py-3.5 align-top md:border-l-0"
                    style={{ ...supportCellBg, borderColor: leadRule }}
                  >
                    <WorkDue row={row} />
                  </td>
                  <td className="w-[12rem] px-4 py-3.5 align-top" style={supportCellBg}>
                    <WorkStatusBadge row={row} className="self-start" />
                  </td>
                  <td
                    className="hidden w-[6.5rem] whitespace-nowrap px-4 py-3.5 align-top text-[12px] text-[var(--text-tertiary)] lg:table-cell"
                    style={supportCellBg}
                    suppressHydrationWarning
                  >
                    {row.lastUpdateAt ? (
                      <span title={row.lastUpdateReadable} aria-label={row.lastUpdateReadable}>
                        {row.lastUpdateLabel}
                      </span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">No updates</span>
                    )}
                  </td>
                  <td className="w-[10.5rem] px-4 py-3.5 text-right align-top">
                    <WorkReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] md:hidden">
        {rows.map((row) => {
          const titleHref = row.display.identity.title.href ?? row.href;
          const contract = row.display.identity.linkedContract;
          const mobileBlock = recordBlockStyle(row);
          return (
            <li
              key={row.key}
              className="space-y-2.5 px-4 py-4 sm:px-5"
              style={rowRailStyle(row)}
            >
              <div className="flex items-center gap-2">
                <WorkTypeIcon row={row} label={row.typeLabel} />
                <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">{row.typeLabel}</span>
                <span className="ml-auto shrink-0">
                  <WorkStatusBadge row={row} />
                </span>
              </div>
              <Link
                href={titleHref}
                title={row.title}
                className="line-clamp-2 block text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {row.display.identity.title.value}
              </Link>
              <WorkNextActionNote row={row} />
              {/* Supporting facts ride a grouped sheet so the card reads as a
                  record with structure, not a loose label stack (§6 composition).
                  The cannot-proceed card's block is faintly oxblood-washed. */}
              <dl
                className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border px-3 py-2.5 text-[11.5px]"
                style={{
                  background: mobileBlock.background,
                  borderColor: mobileBlock.borderColor,
                }}
              >
                <div className="min-w-0">
                  <dt className="ui-caps-3 text-[9px] text-[var(--text-tertiary)]">{WORK_ROW_LABELS.linkedContract}</dt>
                  <dd className="mt-0.5 min-w-0">
                    {contract.href ? (
                      <Link
                        href={contract.href}
                        title={contract.value}
                        className="block truncate text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
                      >
                        {contract.value}
                      </Link>
                    ) : (
                      <span className="block truncate text-[var(--text-tertiary)]">{contract.value}</span>
                    )}
                    {row.counterparty ? (
                      <span className="block truncate text-[10.5px] text-[var(--text-tertiary)]">{row.counterparty}</span>
                    ) : null}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="ui-caps-3 text-[9px] text-[var(--text-tertiary)]">{WORK_ROW_LABELS.owner}</dt>
                  <dd
                    className={`mt-0.5 truncate ${row.ownerLabel === "Unassigned" ? "font-medium" : "text-[var(--text-primary)]"}`}
                    style={row.ownerLabel === "Unassigned" ? { color: "var(--warning-ink)" } : undefined}
                  >
                    {row.ownerLabel}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="ui-caps-3 text-[9px] text-[var(--text-tertiary)]">{WORK_ROW_LABELS.dueDate}</dt>
                  <dd className="mt-0.5">
                    <WorkDue row={row} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="ui-caps-3 text-[9px] text-[var(--text-tertiary)]">{WORK_ROW_LABELS.lastUpdate}</dt>
                  <dd className="mt-0.5 text-[var(--text-tertiary)]" suppressHydrationWarning>
                    {row.lastUpdateAt ? row.lastUpdateLabel : "No updates"}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center justify-end pt-0.5">
                <WorkReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
              </div>
            </li>
          );
        })}
      </ul>

      {pagination.total > 0 ? (
        <DataFooter
          shown={rows.length}
          total={pagination.total}
          sectionLabel="tasks"
          pagination={{
            page: pagination.page,
            totalPages: pagination.totalPages,
            hrefFor: pageHref,
          }}
        />
      ) : null}
    </>
  );
}
