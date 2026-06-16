"use client";

import { LiveRegion } from "@/components/ui/live-region";
import { SearchField } from "@/components/search/search-field";
import { SearchDetailRail } from "./search-detail-rail";
import { FullyRestrictedState, ZeroInFilter, ZeroResults } from "./search-result-bands";
import { FilterChips } from "./search-filter-chips";
import { ResultsCard } from "./search-results-card";
import { useSearchViewState, type SearchViewProps } from "./search-view-state";

export function SearchView(props: SearchViewProps) {
  const {
    role,
    initialQuery,
    fieldRef,
    listId,
    query,
    deferredQuery,
    filterGroup,
    countsByGroup,
    hasQuery,
    totalResults,
    liveRegionMessage,
    grouped,
    isStale,
    handleQueryChange,
    handleFilterChange,
    handleSubmit,
    handleSubmitNewTab,
    handleSelect,
    closestSuggestion,
    recentItems,
    rowRefs,
    activeRowId,
    filteredMatched,
    visibleGroupsForFilter,
    recentsForBand,
    showQuickPick,
    quickPickItems,
    foldedRecentHref,
    isFullyRestricted,
    activeItem,
    setActiveIndex,
  } = useSearchViewState(props);

  if (isFullyRestricted) {
    return <FullyRestrictedState />;
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
      <div className="space-y-4">
        <SearchField
          ref={fieldRef}
          variant="page"
          isCombobox
          ariaControls={listId}
          value={query}
          onChange={handleQueryChange}
          onSubmit={handleSubmit}
          onSubmitNewTab={handleSubmitNewTab}
          onClear={() => handleQueryChange("")}
          placeholder="Type to filter destinations..."
          kbdHint={{ meta: "", key: "/" }}
          ariaLabel="Search workspace"
          ariaKeyShortcuts="ArrowUp ArrowDown Enter Meta+Enter Escape /"
          autoFocusDeferred={!initialQuery}
          testId="search-page-input"
        />

        <FilterChips
          active={filterGroup}
          counts={countsByGroup}
          showCounts={hasQuery}
          onChange={handleFilterChange}
        />

        <LiveRegion message={liveRegionMessage} politeness="polite" />

        {hasQuery && totalResults === 0 ? (
          <ZeroResults
            query={deferredQuery}
            suggestion={closestSuggestion}
            onSuggestionSelect={handleSelect}
            recents={recentItems}
            rowRefs={rowRefs}
            activeRowId={activeRowId}
          />
        ) : filterGroup && totalResults === 0 ? (
          <ZeroInFilter group={filterGroup} onClearFilter={() => handleFilterChange(null)} />
        ) : (
          <ResultsCard
            listId={listId}
            grouped={grouped}
            query={deferredQuery}
            isStale={isStale}
            onSelect={handleSelect}
            onActivate={setActiveIndex}
            visibleGroups={visibleGroupsForFilter}
            rowRefs={rowRefs}
            activeRowId={activeRowId}
            matchedFlat={filteredMatched}
            recents={recentsForBand}
            quickPick={showQuickPick ? quickPickItems : null}
            foldedRecentHref={foldedRecentHref}
            role={role}
          />
        )}
      </div>
      <SearchDetailRail item={activeItem} role={role} onSelect={handleSelect} />
    </div>
  );
}
