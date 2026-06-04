"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
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
    { value: "overdue", label: EVIDENCE_DUE_FILTER_LABELS.overdue },
    { value: "due_soon", label: EVIDENCE_DUE_FILTER_LABELS.due_soon },
    { value: "no_due", label: EVIDENCE_DUE_FILTER_LABELS.no_due },
  ];
  const fileOptions: UiSelectOption[] = [
    { value: "", label: "Any files" },
    { value: "has_file", label: EVIDENCE_FILE_FILTER_LABELS.has_file },
    { value: "missing_file", label: EVIDENCE_FILE_FILTER_LABELS.missing_file },
  ];

  const dueSoonActive = filters.due === "due_soon";
  const missingActive = filters.file === "missing_file";
  // Hide a quick chip whose count is 0 and isn't active — a "Due soon 0" chip
  // adds no action value (§10.10 — don't surface zero-value affordances).
  const showDueSoon = summary.dueSoon > 0 || dueSoonActive;
  const showMissing = summary.missingFile > 0 || missingActive;
  const showQuick = showDueSoon || showMissing;
  const activeChips = buildActiveChips(activeSection, filters, filterOptions);

  return (
    <div className="min-w-0 max-w-full space-y-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
      <div className="grid min-w-0 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-6">
        <FilterField label={EVIDENCE_FILTER_LABELS.owner} value={filters.owner} options={filterOptions.owners} onChange={(v) => apply({ owner: v })} />
        <FilterField label={EVIDENCE_FILTER_LABELS.status} value={filters.status} options={filterOptions.statuses} onChange={(v) => apply({ status: v as EvidenceFilterState["status"] })} />
        <FilterField label={EVIDENCE_FILTER_LABELS.contract} value={filters.contract} options={filterOptions.contracts} onChange={(v) => apply({ contract: v })} />
        <FilterField label={EVIDENCE_FILTER_LABELS.obligation} value={filters.obligation} options={filterOptions.obligations} onChange={(v) => apply({ obligation: v })} />
        <FilterField label={EVIDENCE_FILTER_LABELS.dueDate} value={filters.due} options={dueOptions} onChange={(v) => apply({ due: v as EvidenceFilterState["due"] })} />
        <FilterField label={EVIDENCE_FILTER_LABELS.fileState} value={filters.file} options={fileOptions} onChange={(v) => apply({ file: v as EvidenceFilterState["file"] })} />
      </div>

      {showQuick || hasActiveFilters ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showQuick ? (
            <>
              <span className="ui-caps-2 text-[var(--text-tertiary)]">Quick filters</span>
              {showDueSoon ? (
                <QuickChip
                  label={EVIDENCE_DUE_FILTER_LABELS.due_soon}
                  count={summary.dueSoon}
                  active={dueSoonActive}
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
                  className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 transition-colors hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
              <Link
                href={buildEvidenceHref({ section: activeSection })}
                className="ui-btn-ghost inline-flex items-center rounded-full px-3 py-1 text-[12px]"
              >
                Clear filters
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: UiSelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="block min-w-0 max-w-full">
      <p className="mb-1.5 block text-[12.5px] font-medium text-[var(--text-secondary)]">{label}</p>
      <UiSelect
        className="block w-full"
        // Selected filters (non-default value) get an accent-tinted trigger so
        // an active filter reads at a glance, not just via the chips below.
        buttonClassName={`h-10 w-full ${
          value ? "border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border-strong))]" : ""
        }`}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={options[0]?.label ?? `Any ${label.toLowerCase()}`}
        ariaLabel={label}
        // Portal the popover so it layers above the table instead of blending
        // into it (and never clips inside the shell).
        portal
      />
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
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
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
      title={active ? `Clear ${label} filter` : `Filter to ${label.toLowerCase()}`}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
