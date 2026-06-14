import type { MutableRefObject, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FilterX, Lock, SearchX, X } from "lucide-react";
import { SEARCH_GROUP_LABELS, type SearchGroup } from "@/lib/navigation";
import type { PaletteItem } from "@/components/layout/command-palette-helpers";
import { ResultRow } from "@/components/search/result-row";

export function GroupBandHeader({
  label,
  count,
  showCount,
}: {
  label: string;
  count: number;
  showCount: boolean;
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-4 py-2">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_oklab,var(--text-primary)_70%,transparent)]">
        {label}
      </h2>
      {showCount ? (
        <span className="text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
          <span className="sr-only">{count} result{count === 1 ? "" : "s"}</span>
          <span aria-hidden>{count}</span>
        </span>
      ) : null}
    </header>
  );
}

export function BandSection({
  label,
  count,
  showCount,
  children,
}: {
  label: string;
  count: number;
  showCount: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={label}>
      <GroupBandHeader label={label} count={count} showCount={showCount} />
      {children}
    </section>
  );
}

export function BandList({
  items,
  rowIdPrefix,
  onSelect,
  rowRefs,
  activeRowId,
}: {
  items: PaletteItem[];
  rowIdPrefix: string;
  onSelect: (href: string) => void;
  rowRefs: MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
}) {
  return (
    <ul>
      {items.map((item, idx) => {
        const id = `${rowIdPrefix}-${idx}`;
        return (
          <li key={item.href}>
            <ResultRow
              item={item}
              onSelect={onSelect}
              rowId={id}
              hidePath
              refMap={rowRefs}
              isActive={id === activeRowId}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function ZeroResults({
  query,
  suggestion,
  onSuggestionSelect,
  recents,
  rowRefs,
  activeRowId,
}: {
  query: string;
  suggestion: PaletteItem | null;
  onSuggestionSelect: (href: string) => void;
  recents: PaletteItem[];
  rowRefs: MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
}) {
  const trimmed = query.trim();
  const contractsSearchHref = `/contracts?search=${encodeURIComponent(trimmed.slice(0, 120))}`;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-6 shadow-[var(--shadow-1)]">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
        >
          <SearchX className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">No matches</p>
          <p className="mt-1 truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            Nothing matched &ldquo;{trimmed}&rdquo;
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--text-secondary)]">
            {suggestion ? (
              <span className="inline-flex items-center gap-1">
                Did you mean:
                <Link
                  href={suggestion.href}
                  onClick={() => onSuggestionSelect(suggestion.href)}
                  className="ui-link font-semibold"
                >
                  {suggestion.name}
                </Link>
              </span>
            ) : null}
            <Link href={contractsSearchHref} className="ui-link inline-flex items-center gap-1 font-semibold">
              Search contracts for &ldquo;{trimmed}&rdquo;
              <ArrowRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
      {recents.length > 0 ? (
        <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <BandSection label="Recent" count={recents.length} showCount={recents.length > 1}>
            <BandList
              items={recents}
              rowIdPrefix="search-recent"
              onSelect={onSuggestionSelect}
              rowRefs={rowRefs}
              activeRowId={activeRowId}
            />
          </BandSection>
        </div>
      ) : null}
    </div>
  );
}

export function ZeroInFilter({
  group,
  onClearFilter,
}: {
  group: SearchGroup;
  onClearFilter: () => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-6 shadow-[var(--shadow-1)]">
      <span
        aria-hidden
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
      >
        <FilterX className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ui-caps-2 text-[var(--text-tertiary)]">Filtered</p>
        <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          No matches in {SEARCH_GROUP_LABELS[group]}
        </p>
        <button
          type="button"
          onClick={onClearFilter}
          className="ui-btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden />
          Clear filter
        </button>
      </div>
    </div>
  );
}

export function FullyRestrictedState() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-6 shadow-[var(--shadow-1)]">
      <span
        aria-hidden
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--border-strong)_45%,var(--border-subtle))] bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
      >
        <Lock className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ui-caps-2 text-[var(--text-tertiary)]">Restricted</p>
        <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          No destinations available
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">
          This workspace doesn&apos;t expose searchable pages for your role. Contact a workspace admin to expand access.
        </p>
        <Link
          href="/dashboard"
          className="ui-btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
