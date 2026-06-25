"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { type UiSelectOption } from "@/components/ui/ui-select";
import type { DropdownStatusTone } from "@/components/ui/dropdown";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { buildEvidenceHref } from "@/lib/evidence/href";
import {
  EVIDENCE_DUE_FILTER_LABELS,
  EVIDENCE_FILE_FILTER_LABELS,
  EVIDENCE_FILTER_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "@/lib/evidence/spec-strings";
import type {
  EvidenceFilterState,
  EvidenceOption,
  EvidenceSectionKey,
} from "@/lib/evidence/types";

type EvidenceFilterOptions = {
  owners: EvidenceOption[];
  statuses: EvidenceOption[];
  contracts: EvidenceOption[];
  obligations: EvidenceOption[];
};

// Tone dot per evidence status (§2.5), shown INSIDE the open STATUS list only
// (DropdownOptionRow renders it; the closed pill stays neutral). accepted =
// success, received = warning (received, awaiting review), overdue/rejected =
// danger, requested = neutral (sent, awaiting the counterparty). "Any status"
// (value "") carries no dot.
const EVIDENCE_STATUS_DOT: Record<string, DropdownStatusTone> = {
  overdue: "danger",
  rejected: "danger",
  accepted: "success",
  received: "warning",
  requested: "neutral",
};

// Apply-live filter bar: each dropdown navigates on change (no Apply button, so
// there is no "did it apply?" ambiguity). Quick chips and active-filter chips
// are URL links. buildEvidenceHref is a pure helper (no server deps) so it is
// safe to import here.
export function EvidenceFilterBar({
  activeSection,
  filters,
  filterOptions,
  summary,
  hasActiveFilters,
}: {
  activeSection: EvidenceSectionKey;
  filters: EvidenceFilterState;
  filterOptions: EvidenceFilterOptions;
  summary: { dueSoon: number; missingFile: number };
  hasActiveFilters: boolean;
}) {
  const router = useRouter();
  const apply = (next: Partial<EvidenceFilterState>) =>
    router.push(buildEvidenceHref({ section: activeSection, filters: { ...filters, ...next } }));

  const dueOptions: UiSelectOption[] = [
    { value: "", label: "Any due date" },
    { value: "overdue", label: EVIDENCE_DUE_FILTER_LABELS.overdue, statusDot: "danger" },
    { value: "due_soon", label: EVIDENCE_DUE_FILTER_LABELS.due_soon, statusDot: "warning" },
    { value: "no_due", label: EVIDENCE_DUE_FILTER_LABELS.no_due, statusDot: "neutral" },
  ];
  const fileOptions: UiSelectOption[] = [
    { value: "", label: "Any files" },
    { value: "has_file", label: EVIDENCE_FILE_FILTER_LABELS.has_file, icon: "paperclip" },
    { value: "missing_file", label: EVIDENCE_FILE_FILTER_LABELS.missing_file, icon: "file-x" },
  ];
  // Decorate the data-driven status options with their tone dot — a presentation
  // concern, so it lives here and the server model stays a pure {value,label}.
  const statusOptions: UiSelectOption[] = filterOptions.statuses.map((option) =>
    option.value ? { ...option, statusDot: EVIDENCE_STATUS_DOT[option.value] } : option
  );

  const dueSoonActive = filters.due === "due_soon";
  const missingActive = filters.file === "missing_file";
  // Hide a quick chip whose count is 0 and isn't active — a "Due soon 0" chip
  // adds no action value (§10.10 — don't surface zero-value affordances).
  const showDueSoon = summary.dueSoon > 0 || dueSoonActive;
  const showMissing = summary.missingFile > 0 || missingActive;
  const showQuick = showDueSoon || showMissing;
  const activeChips = buildActiveChips(activeSection, filters, filterOptions);
  const activeFilterCount = [
    filters.owner,
    filters.status,
    filters.contract,
    filters.obligation,
    filters.due,
    filters.file,
  ].filter(Boolean).length;
  const clearFiltersHref = buildEvidenceHref({ section: activeSection });

  return (
    // Subordinate control strip: the filter band is deliberately quieter than the
    // record below it — a faint muted ground and a hairline rule instead of a
    // boxed panel, led by a small "Refine queue" caps label so the six dropdowns
    // read as secondary controls, not the page's first object (product-owner
    // direction #3; §6 the record is dominant, the filters subordinate).
    <div className="min-w-0 max-w-full space-y-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)] px-5 py-2.5">
      <FilterBar activeFilterCount={activeFilterCount} clearFiltersHref={clearFiltersHref}>
        <span className="ui-caps-2 mr-0.5 hidden shrink-0 self-center text-[10px] text-[var(--text-tertiary)] sm:inline">
          Refine queue
        </span>
        <FilterSelect label={EVIDENCE_FILTER_LABELS.owner} value={filters.owner} options={filterOptions.owners} onChange={(v) => apply({ owner: v })} />
        <FilterSelect label={EVIDENCE_FILTER_LABELS.status} value={filters.status} options={statusOptions} onChange={(v) => apply({ status: v as EvidenceFilterState["status"] })} />
        <FilterSelect label={EVIDENCE_FILTER_LABELS.contract} value={filters.contract} options={filterOptions.contracts} onChange={(v) => apply({ contract: v })} />
        <FilterSelect label={EVIDENCE_FILTER_LABELS.obligation} value={filters.obligation} options={filterOptions.obligations} onChange={(v) => apply({ obligation: v })} />
        <FilterSelect label={EVIDENCE_FILTER_LABELS.dueDate} value={filters.due} options={dueOptions} onChange={(v) => apply({ due: v as EvidenceFilterState["due"] })} />
        <FilterSelect label={EVIDENCE_FILTER_LABELS.fileState} value={filters.file} options={fileOptions} onChange={(v) => apply({ file: v as EvidenceFilterState["file"] })} />
      </FilterBar>

      {showQuick || hasActiveFilters ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showQuick ? (
            <>
              <span className="text-[11.5px] font-medium text-[var(--text-tertiary)]">
                Quick filters
              </span>
              {showDueSoon ? (
                <QuickChip
                  label={EVIDENCE_DUE_FILTER_LABELS.due_soon}
                  count={summary.dueSoon}
                  active={dueSoonActive}
                  accessibleLabel={`${summary.dueSoon} evidence ${summary.dueSoon === 1 ? "request" : "requests"} due within 7 days`}
                  description="The request is due within the next 7 days."
                  href={buildEvidenceHref({
                    section: activeSection,
                    filters: { ...filters, due: dueSoonActive ? "" : "due_soon" },
                  })}
                />
              ) : null}
              {showMissing ? (
                <QuickChip
                  label={EVIDENCE_FILE_FILTER_LABELS.missing_file}
                  count={summary.missingFile}
                  active={missingActive}
                  accessibleLabel={`${summary.missingFile} evidence ${summary.missingFile === 1 ? "request" : "requests"} missing a file`}
                  description="No evidence file is attached, so the request can't be accepted yet."
                  href={buildEvidenceHref({
                    section: activeSection,
                    filters: { ...filters, file: missingActive ? "" : "missing_file" },
                  })}
                />
              ) : null}
            </>
          ) : null}
          {hasActiveFilters ? (
            <>
              {showQuick ? (
                <span aria-hidden className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
              ) : (
                <span className="ui-caps-2 text-[var(--text-tertiary)]">Filtered by</span>
              )}
              {activeChips.map((chip) => (
                <Link
                  key={chip.key}
                  href={chip.href}
                  aria-label={`Remove ${chip.label} filter`}
                  className="group inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 transition-colors hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="ui-caps-3 text-[var(--text-tertiary)]">{chip.label}</span>
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">{chip.value}</span>
                  <X
                    className="h-3 w-3 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                </Link>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Selected quick filter reads in accent blue (the §10.2 interactive/selected
// tone), inactive reads as a neutral outline.
function QuickChip({
  label,
  count,
  active,
  href,
  accessibleLabel,
  description,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  /** Full object-typed name for assistive tech, so the compact visible chip
   *  ("Missing file 1") still announces what is counted (§19). */
  accessibleLabel?: string;
  /** Fuller definition shown as a hover/focus tooltip (+ appended to the
   *  accessible name) — matches the Contracts condition chips. */
  description?: string;
}) {
  // Quick filters carry the warning semantics of the state they surface
  // (due soon / missing file), so they're toned consistently — a muted warning
  // outline when idle, filled warning when active. Geometry matches the summary
  // KeyValueChips (rounded-full · px-2 · caps 0.14em) so the header overview and
  // these filter toggles read as one chip vocabulary; the outline-vs-filled tone
  // is what marks these as the interactive ones.
  const ink = "var(--warning-ink)";
  return (
    <Link
      href={href}
      aria-label={
        accessibleLabel
          ? `${active ? "Clear filter:" : "Filter to"} ${accessibleLabel}${description ? `. ${description}` : ""}`
          : undefined
      }
      className="group relative inline-flex max-w-full items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      style={
        active
          ? {
              borderColor: `color-mix(in oklab, ${ink} 44%, var(--border-card))`,
              background: `color-mix(in oklab, ${ink} 16%, var(--surface-raised))`,
              color: ink,
            }
          : {
              borderColor: `color-mix(in oklab, ${ink} 26%, var(--border-subtle))`,
              background: "var(--surface-raised)",
              color: `color-mix(in oklab, ${ink} 78%, var(--text-secondary))`,
            }
      }
    >
      <span>{label}</span>
      <span className="tabular-nums" style={{ color: ink }}>
        {count}
      </span>
      {active ? <X className="h-3 w-3" strokeWidth={2} aria-hidden /> : null}
      {description ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[calc(100%+7px)] left-0 z-30 w-max max-w-[16rem] rounded-md bg-[var(--text-primary)] px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-[var(--surface)] opacity-0 shadow-[var(--shadow-2)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          {description}
          <span className="absolute left-3 top-full h-2 w-2 -translate-y-1/2 rotate-45 bg-[var(--text-primary)]" />
        </span>
      ) : null}
    </Link>
  );
}

function buildActiveChips(
  activeSection: EvidenceSectionKey,
  filters: EvidenceFilterState,
  filterOptions: EvidenceFilterOptions
): { key: string; label: string; value: string; href: string }[] {
  const optionLabel = (options: EvidenceOption[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const dueLabels = EVIDENCE_DUE_FILTER_LABELS as Record<string, string>;
  const fileLabels = EVIDENCE_FILE_FILTER_LABELS as Record<string, string>;
  const statusLabels = EVIDENCE_STATUS_LABELS as Record<string, string>;
  const chips: { key: string; label: string; value: string; href: string }[] = [];
  const clearHref = (next: Partial<EvidenceFilterState>) =>
    buildEvidenceHref({ section: activeSection, filters: { ...filters, ...next } });
  if (filters.owner) {
    chips.push({ key: "owner", label: EVIDENCE_FILTER_LABELS.owner, value: optionLabel(filterOptions.owners, filters.owner), href: clearHref({ owner: "" }) });
  }
  if (filters.status) {
    chips.push({ key: "status", label: EVIDENCE_FILTER_LABELS.status, value: statusLabels[filters.status] ?? filters.status, href: clearHref({ status: "" }) });
  }
  if (filters.contract) {
    chips.push({ key: "contract", label: EVIDENCE_FILTER_LABELS.contract, value: optionLabel(filterOptions.contracts, filters.contract), href: clearHref({ contract: "" }) });
  }
  if (filters.obligation) {
    chips.push({ key: "obligation", label: EVIDENCE_FILTER_LABELS.obligation, value: optionLabel(filterOptions.obligations, filters.obligation), href: clearHref({ obligation: "" }) });
  }
  if (filters.due) {
    chips.push({ key: "due", label: EVIDENCE_FILTER_LABELS.dueDate, value: dueLabels[filters.due] ?? filters.due, href: clearHref({ due: "" }) });
  }
  if (filters.file) {
    chips.push({ key: "file", label: EVIDENCE_FILTER_LABELS.fileState, value: fileLabels[filters.file] ?? filters.file, href: clearHref({ file: "" }) });
  }
  return chips;
}
