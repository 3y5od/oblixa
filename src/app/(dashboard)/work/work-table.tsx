import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  FileText,
  ListChecks,
  Paperclip,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { WorkReleaseActions } from "@/components/work/work-release-actions";
import { DataFooter } from "@/components/ui/data-footer";
import { StatusBadge } from "@/components/ui/status-badge";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WORK_EMPTY_STATE, WORK_ROW_LABELS } from "@/lib/work/spec-strings";
import type { WorkItemRow, WorkPageModel, WorkTypeKey } from "@/lib/work/types";

const WORK_TYPE_ICONS: Record<WorkTypeKey, LucideIcon> = {
  contract_task: ListChecks,
  obligation: FileText,
  approval: BadgeCheck,
  exception: TriangleAlert,
  evidence_request: Paperclip,
  renewal_checkpoint: CalendarClock,
  unassigned_work: UserPlus,
};

function WorkTypeIcon({ type, label }: { type: WorkTypeKey; label: string }) {
  const Icon = WORK_TYPE_ICONS[type];
  return (
    <span
      title={label}
      aria-hidden
      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] text-[var(--text-tertiary)]"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
    </span>
  );
}

function WorkStatusBadge({ row }: { row: WorkItemRow }) {
  return (
    <StatusBadge status={row.statusTone} className="gap-1.5 self-start">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        style={{ boxShadow: "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)" }}
      />
      {row.statusLabel}
    </StatusBadge>
  );
}

function WorkNextActionNote({ note }: { note: string }) {
  return (
    <p className="mt-1 max-w-[36rem] text-[11.5px] leading-snug text-[var(--text-secondary)]">
      {note}
    </p>
  );
}

function WorkDue({ row }: { row: WorkItemRow }) {
  if (!row.dueAt || !row.duePrimaryLabel) {
    return <span className="text-[12px] text-[var(--text-tertiary)]">No due date</span>;
  }
  const relTone =
    row.dueState === "overdue"
      ? "var(--danger-ink)"
      : row.dueState === "due_today" || row.dueState === "due_soon"
        ? "var(--warning-ink)"
        : "var(--text-tertiary)";
  return (
    <span className="flex flex-col items-start gap-0.5 tabular-nums">
      <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
        {row.duePrimaryLabel}
      </span>
      {row.dueRelativeLabel ? (
        <span className="text-[11px] font-medium" style={{ color: relTone }}>
          {row.dueRelativeLabel}
        </span>
      ) : null}
    </span>
  );
}

function WorkContractCell({ row, max }: { row: WorkItemRow; max: string }) {
  const contract = row.display.identity.linkedContract;
  return (
    <span className="block min-w-0">
      {contract.href ? (
        <Link
          href={contract.href}
          title={contract.value}
          className={`block ${max} truncate text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]`}
        >
          {contract.value}
        </Link>
      ) : (
        <span className={`block ${max} truncate text-[12.5px] text-[var(--text-tertiary)]`}>
          {contract.value}
        </span>
      )}
      {row.counterparty ? (
        <span className={`block ${max} truncate text-[11px] text-[var(--text-tertiary)]`} title={row.counterparty}>
          {row.counterparty}
        </span>
      ) : null}
    </span>
  );
}

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
              return (
                <tr key={row.key} className="ui-table-row group">
                  <td className="px-5 py-2.5 align-top">
                    <div className="flex items-start gap-2.5">
                      <WorkTypeIcon type={row.type} label={row.typeLabel} />
                      <div className="min-w-0">
                        <span className="ui-caps-3 block text-[9.5px] leading-none text-[var(--text-tertiary)]">
                          {row.typeLabel}
                        </span>
                        <Link
                          href={titleHref}
                          title={row.title}
                          className="mt-1 block max-w-[30rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
                        >
                          {row.display.identity.title.value}
                        </Link>
                        {row.nextActionNote ? <WorkNextActionNote note={row.nextActionNote} /> : null}
                        <div className="mt-1 lg:hidden">
                          {contract.href ? (
                            <Link
                              href={contract.href}
                              title={contract.value}
                              className="block max-w-[24rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                            >
                              {contract.value}
                              {row.counterparty ? ` · ${row.counterparty}` : ""}
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
                  <td className="hidden w-[13rem] px-4 py-2.5 align-top lg:table-cell">
                    <WorkContractCell row={row} max="max-w-[12rem]" />
                  </td>
                  <td className="hidden w-[9rem] whitespace-nowrap px-4 py-2.5 align-top md:table-cell">
                    <span
                      title={row.ownerLabel}
                      className={
                        row.ownerLabel === "Unassigned"
                          ? "block truncate text-[12.5px] text-[var(--text-tertiary)]"
                          : "block truncate text-[12.5px] text-[var(--text-primary)]"
                      }
                    >
                      {row.ownerLabel}
                    </span>
                  </td>
                  <td className="w-[9.5rem] px-4 py-2.5 align-top">
                    <WorkDue row={row} />
                  </td>
                  <td className="w-[12rem] px-4 py-2.5 align-top">
                    <WorkStatusBadge row={row} />
                  </td>
                  <td
                    className="hidden w-[6.5rem] whitespace-nowrap px-4 py-2.5 align-top text-[12px] text-[var(--text-tertiary)] lg:table-cell"
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
                  <td className="w-[10.5rem] px-4 py-2.5 text-right align-top">
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
          return (
            <li key={row.key} className="space-y-2 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <WorkTypeIcon type={row.type} label={row.typeLabel} />
                <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">{row.typeLabel}</span>
                <span className="ml-auto shrink-0">
                  <WorkStatusBadge row={row} />
                </span>
              </div>
              <Link
                href={titleHref}
                title={row.title}
                className="line-clamp-2 block font-semibold leading-snug text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {row.display.identity.title.value}
              </Link>
              {row.nextActionNote ? <WorkNextActionNote note={row.nextActionNote} /> : null}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5 text-[11.5px]">
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
                  <dd className={`mt-0.5 truncate ${row.ownerLabel === "Unassigned" ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
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
