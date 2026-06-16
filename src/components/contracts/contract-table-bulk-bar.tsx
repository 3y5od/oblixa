import type { FormEventHandler } from "react";
import { UiSelect } from "@/components/ui/ui-select";
import type { ContractTableBulkActions } from "./contract-table-types";

export function ContractTableBulkBar({
  selectedList,
  hiddenSelectedCount,
  filterFingerprint,
  exportHref,
  requestReviewHref,
  archiveHref,
  bulkActions,
  bulkError,
  isBulkAssignPending,
  onClearSelection,
  onBulkAssignSubmit,
}: {
  selectedList: string[];
  hiddenSelectedCount: number;
  filterFingerprint?: string;
  exportHref: string | null;
  requestReviewHref: string | null;
  archiveHref: string | null;
  bulkActions: ContractTableBulkActions;
  bulkError: string | null;
  isBulkAssignPending: boolean;
  onClearSelection: () => void;
  onBulkAssignSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <div
      className="flex flex-col gap-3 border-b border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-1">
        <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
          <span aria-hidden className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          {selectedList.length} selected
        </p>
        {hiddenSelectedCount > 0 ? (
          <p className="text-[11px] font-semibold uppercase tabular-nums text-[var(--text-tertiary)]">
            {hiddenSelectedCount} outside this page {"\u00b7"} Persists across filters
          </p>
        ) : filterFingerprint ? (
          <p className="text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">
            Selection persists across pages
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {exportHref ? (
          <a href={exportHref} className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            Export CSV
          </a>
        ) : null}
        {requestReviewHref ? (
          <a href={requestReviewHref} className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            Request review
          </a>
        ) : null}
        {archiveHref ? (
          <a href={archiveHref} className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            Archive
          </a>
        ) : null}
        <button
          type="button"
          className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          onClick={onClearSelection}
        >
          Clear
        </button>
        {bulkActions.canEdit && bulkActions.members.length > 0 ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={onBulkAssignSubmit}>
            <input type="hidden" name="contractIds" value={selectedList.join(",")} />
            <UiSelect
              name="newOwnerId"
              required
              ariaLabel="Assign owner"
              placeholder="Assign to..."
              disabled={isBulkAssignPending}
              className="min-w-[10rem] max-w-[16rem]"
              buttonClassName="h-8 text-[12.5px]"
              options={bulkActions.members.map((m) => ({
                value: m.id,
                label: m.label,
              }))}
            />
            <button
              type="submit"
              className="ui-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              disabled={isBulkAssignPending}
            >
              {isBulkAssignPending ? "Assigning..." : "Apply"}
            </button>
            {bulkError ? (
              <span className="text-[12.5px] font-medium text-[var(--danger-ink)]" role="alert">
                {bulkError}
              </span>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
