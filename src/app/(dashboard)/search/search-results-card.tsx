import type { MutableRefObject } from "react";
import { SEARCH_GROUP_LABELS, type SearchGroup, type WorkspaceRole } from "@/lib/navigation";
import { paletteHrefKey, type PaletteItem } from "@/components/layout/command-palette-helpers";
import { ResultRow } from "@/components/search/result-row";
import { BandList, BandSection, GroupBandHeader } from "./search-result-bands";

export function ResultsCard({
  listId,
  grouped,
  query,
  isStale,
  onSelect,
  onActivate,
  visibleGroups,
  rowRefs,
  activeRowId,
  matchedFlat,
  recents,
  quickPick,
  foldedRecentHref,
  role,
}: {
  listId: string;
  grouped: Map<SearchGroup, PaletteItem[]>;
  query: string;
  isStale: boolean;
  onSelect: (href: string) => void;
  onActivate: (index: number) => void;
  visibleGroups: readonly SearchGroup[];
  rowRefs: MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
  matchedFlat: PaletteItem[];
  recents: PaletteItem[] | null;
  quickPick: PaletteItem[] | null;
  foldedRecentHref: string | null;
  role: WorkspaceRole;
}) {
  const groupsWithItems = visibleGroups.filter((group) => (grouped.get(group)?.length ?? 0) > 0);
  const hasAnyBand = (recents?.length ?? 0) > 0 || (quickPick?.length ?? 0) > 0 || groupsWithItems.length > 0;
  if (!hasAnyBand) return <p className="text-[13px] text-[var(--text-secondary)]">Type to search, or pick a destination below.</p>;

  const flatIndexByHref = new Map<string, number>();
  matchedFlat.forEach((item, idx) => {
    flatIndexByHref.set(item.href, idx);
  });

  return (
    <section
      id={listId}
      aria-label="Search results"
      aria-busy={isStale ? "true" : "false"}
      className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]"
    >
      {recents && recents.length > 0 ? (
        <BandSection label="Recent" count={recents.length} showCount={recents.length > 1}>
          <BandList items={recents} rowIdPrefix="search-recent" onSelect={onSelect} rowRefs={rowRefs} activeRowId={activeRowId} />
        </BandSection>
      ) : null}
      {quickPick && quickPick.length > 0 ? (
        <BandSection label="Quick pick" count={quickPick.length} showCount={false}>
          <BandList items={quickPick} rowIdPrefix="search-quick" onSelect={onSelect} rowRefs={rowRefs} activeRowId={activeRowId} />
        </BandSection>
      ) : null}
      {groupsWithItems.map((group) => {
        const items = grouped.get(group) ?? [];
        if (group === "tools") {
          return (
            <ToolsBand
              key={group}
              items={items}
              onSelect={onSelect}
              onActivate={onActivate}
              rowRefs={rowRefs}
              activeRowId={activeRowId}
              flatIndexByHref={flatIndexByHref}
              query={query}
              count={items.length}
              showCount={items.length > 1}
              foldedRecentHref={foldedRecentHref}
              role={role}
            />
          );
        }
        return (
          <BandSection key={group} label={SEARCH_GROUP_LABELS[group]} count={items.length} showCount={items.length > 1}>
            <ul>
              {items.map((item) => (
                <SearchResultRow
                  key={item.href}
                  item={item}
                  query={query}
                  onSelect={onSelect}
                  onActivate={onActivate}
                  rowRefs={rowRefs}
                  activeRowId={activeRowId}
                  flatIndexByHref={flatIndexByHref}
                  foldedRecentHref={foldedRecentHref}
                />
              ))}
            </ul>
          </BandSection>
        );
      })}
    </section>
  );
}

function ToolsBand({
  items,
  onSelect,
  onActivate,
  rowRefs,
  activeRowId,
  flatIndexByHref,
  query,
  count,
  showCount,
  foldedRecentHref,
  role,
}: {
  items: PaletteItem[];
  onSelect: (href: string) => void;
  onActivate: (index: number) => void;
  rowRefs: MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
  flatIndexByHref: Map<string, number>;
  query: string;
  count: number;
  showCount: boolean;
  foldedRecentHref: string | null;
  role: WorkspaceRole;
}) {
  const subgroupOrder: readonly NonNullable<PaletteItem["searchSubgroup"]>[] = ["account", "workspace", "operations"];
  const subgroupRank = new Map<string, number>();
  subgroupOrder.forEach((s, i) => subgroupRank.set(s, i));
  const ordered = [...items].sort((a, b) => {
    const ar = a.searchSubgroup ? (subgroupRank.get(a.searchSubgroup) ?? 99) : 99;
    const br = b.searchSubgroup ? (subgroupRank.get(b.searchSubgroup) ?? 99) : 99;
    return ar - br;
  });

  return (
    <section aria-label={SEARCH_GROUP_LABELS.tools}>
      <GroupBandHeader label={SEARCH_GROUP_LABELS.tools} count={count} showCount={showCount} />
      <ul>
        {ordered.map((item) => (
          <SearchResultRow
            key={item.href}
            item={item}
            role={role}
            query={query}
            onSelect={onSelect}
            onActivate={onActivate}
            rowRefs={rowRefs}
            activeRowId={activeRowId}
            flatIndexByHref={flatIndexByHref}
            foldedRecentHref={foldedRecentHref}
          />
        ))}
      </ul>
    </section>
  );
}

function SearchResultRow({
  item,
  role,
  query,
  onSelect,
  onActivate,
  rowRefs,
  activeRowId,
  flatIndexByHref,
  foldedRecentHref,
}: {
  item: PaletteItem;
  role?: WorkspaceRole;
  query: string;
  onSelect: (href: string) => void;
  onActivate: (index: number) => void;
  rowRefs: MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
  flatIndexByHref: Map<string, number>;
  foldedRecentHref: string | null;
}) {
  const flatIdx = flatIndexByHref.get(item.href) ?? -1;
  const id = `search-row-${flatIdx}`;
  const isActive = id === activeRowId;
  const isRecent = !isActive && foldedRecentHref !== null && paletteHrefKey(item.href) === foldedRecentHref;
  return (
    <li>
      <ResultRow
        item={item}
        role={role}
        query={query}
        onSelect={onSelect}
        onActivate={flatIdx >= 0 ? () => onActivate(flatIdx) : undefined}
        rowId={id}
        hidePath
        hideMeta
        refMap={rowRefs}
        isActive={isActive}
        isRecent={isRecent}
      />
    </li>
  );
}
