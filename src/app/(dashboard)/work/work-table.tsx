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
import { TimeChip } from "@/components/ui/time-chip";
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
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] text-[var(--text-tertiary)]"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
      <span className="sr-only">{label}</span>
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
function BlockerNote({ reason }: { reason: string }) {
  return (
    <span
      title={reason}
      className="inline-flex max-w-[11rem] items-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-tertiary)]"
    >
      <span className="truncate">{reason}</span>
    </span>
  );
}

function WorkDue({ row }: { row: WorkItemRow }) {
  if (!row.dueAt) {
    return (
      <span className="flex flex-col items-start gap-0.5">
        <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
        <span aria-hidden className="ui-caps-3 text-[10px] text-transparent">
          &nbsp;
        </span>
      </span>
    );
  }
  const descriptor = dueDescriptor(row.dueInDays);
  return (
    <span className="flex flex-col items-start gap-0.5 tabular-nums">
      <TimeChip
        date={row.dueAt}
        format="calendar"
        tone={
          row.dueState === "overdue"
            ? "danger"
            : row.dueState === "due_today" || row.dueState === "due_soon"
              ? "warning"
              : undefined
        }
        className="min-w-[3.5rem]"
      />
      <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
        {descriptor ?? " "}
      </span>
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

            <th className="px-5 py-3">Task</th>
            <th className="hidden w-[13rem] px-4 py-3 lg:table-cell">{WORK_ROW_LABELS.linkedContract}</th>
            <th className="hidden w-[9rem] px-4 py-3 md:table-cell">{WORK_ROW_LABELS.owner}</th>
            <th className="w-[8.5rem] px-4 py-3">{WORK_ROW_LABELS.dueDate}</th>
            <th className="w-[13rem] px-4 py-3">{WORK_ROW_LABELS.status}</th>
            <th className="hidden w-[4.75rem] px-4 py-3 lg:table-cell">{WORK_ROW_LABELS.lastUpdate}</th>
            <th className="w-[7.5rem] px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
              const titleHref = row.display.identity.title.href ?? row.href;
              const contract = row.display.identity.linkedContract;
              const showBlocker = row.blocker !== "—";
              return (
                <tr key={row.key} className="ui-table-row group">
                  <td className="px-5 py-2 align-middle">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">

                        <WorkTypeIcon type={row.type} label={row.typeLabel} />

                        <Link
                          href={titleHref}
                          title={row.title}
                          className="block max-w-[28rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
                        >
                          {row.display.identity.title.value}
                        </Link>
                      </div>

                      <div className="mt-0.5 lg:hidden">
                        {contract.href ? (
                          <Link
                            href={contract.href}
                            title={contract.value}
                            className="block max-w-[22rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                          >
                            {contract.value}
                          </Link>
                        ) : (
                          <span className="block text-[11.5px] text-[var(--text-tertiary)]">{contract.value}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden w-[13rem] px-4 py-2 align-middle lg:table-cell">
                    {contract.href ? (
                      <Link
                        href={contract.href}
                        title={contract.value}
                        className="block max-w-[12rem] truncate text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
                      >
                        {contract.value}
                      </Link>
                    ) : (
                      <span className="block max-w-[12rem] truncate text-[12.5px] text-[var(--text-tertiary)]">
                        {contract.value}
                      </span>
                    )}
                  </td>
                  <td className="hidden w-[9rem] whitespace-nowrap px-4 py-2 align-middle md:table-cell">
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
                  <td className="w-[8.5rem] px-4 py-2 align-middle">
                    <WorkDue row={row} />
                  </td>
                  <td className="w-[13rem] px-4 py-2 align-middle">
                    <div className="flex flex-col gap-1">
                      <WorkStatusBadge row={row} />

                      {showBlocker ? <BlockerNote reason={row.blocker} /> : null}
                    </div>
                  </td>
                  <td
                    className="hidden w-[4.75rem] whitespace-nowrap px-4 py-2 align-middle tabular-nums lg:table-cell"
                    suppressHydrationWarning
                  >
                    {row.lastUpdateAt ? (
                      <TimeChip date={row.lastUpdateAt} />
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>

                  <td className="w-[7.5rem] px-4 py-2 text-right align-middle">
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
          const showBlocker = row.blocker !== "—";
          return (
            <li key={row.key} className="space-y-1.5 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <WorkTypeIcon type={row.type} label={row.typeLabel} />
                <WorkStatusBadge row={row} />
                <span className="ml-auto shrink-0">
                  <WorkDue row={row} />
                </span>
              </div>
              <Link
                href={titleHref}
                title={row.title}
                className="line-clamp-2 block font-semibold leading-snug text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {row.display.identity.title.value}
              </Link>
              <div className="flex flex-wrap items-center gap-y-0.5 text-[11.5px] text-[var(--text-tertiary)]">
                {contract.href ? (
                  <Link
                    href={contract.href}
                    title={contract.value}
                    className="max-w-[15rem] truncate text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
                  >
                    {contract.value}
                  </Link>
                ) : (
                  <span className="max-w-[15rem] truncate">{contract.value}</span>
                )}
                <span className="ui-dot-sep" aria-hidden>
                  ·
                </span>
                <span className={row.ownerLabel === "Unassigned" ? "" : "text-[var(--text-secondary)]"}>
                  {row.ownerLabel}
                </span>
              </div>
              {showBlocker ? <BlockerNote reason={row.blocker} /> : null}
              <div className="flex items-center justify-end">
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

function dueDescriptor(dueInDays: number | null): string | null {
  if (dueInDays == null) return null;
  if (dueInDays < 0) return `Past due ${Math.abs(dueInDays)}d`;
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due tomorrow";
  return `In ${dueInDays}d`;
}
