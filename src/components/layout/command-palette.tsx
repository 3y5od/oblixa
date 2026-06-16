"use client";

import { Search } from "lucide-react";
import { shellTestIds } from "@/lib/qa/test-ids";
import { CommandPaletteDialog } from "./command-palette-dialog";
import {
  useCommandPaletteState,
  type CommandPaletteProps,
} from "./command-palette-state";

export function CommandPalette(props: CommandPaletteProps) {
  const {
    openButtonRef,
    fieldRef,
    role,
    open,
    setOpen,
    footerVisible,
    query,
    hasQuery,
    announcement,
    flatItems,
    orderedGroups,
    flatIndexByHref,
    clampedActiveIndex,
    recentsForBand,
    showQuickPick,
    quickPickItems,
    foldedRecentHref,
    activeItem,
    activeGroupLabel,
    activeVerb,
    railVisible,
    remoteSearchLoading,
    remoteSearchFailed,
    remoteSearchPartial,
    remoteSearchRecovery,
    deferredFilterQ,
    fullSearchHref,
    rememberReturnFocusTarget,
    clearRemoteSearchFeedback,
    handleQueryChange,
    handleSelectRow,
    handleResultsScroll,
    setQuery,
    setActiveIndex,
    setRailVisible,
    setRemoteSearchFailed,
    setRemoteSearchRetryNonce,
  } = useCommandPaletteState(props);

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => {
          rememberReturnFocusTarget();
          setOpen(true);
        }}
        data-testid={shellTestIds.commandPaletteTrigger}
        className={`fixed bottom-5 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-tint)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop-blur-md transition-[opacity,transform] hover:-translate-y-0.5 lg:hidden ${
          footerVisible ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-label="Open command palette"
      >
        <Search size={14} aria-hidden />
        <span>Search</span>
        <span className="ui-kbd">K</span>
      </button>

      {open && (
        <CommandPaletteDialog
          fieldRef={fieldRef}
          role={role}
          query={query}
          hasQuery={hasQuery}
          announcement={announcement}
          flatItems={flatItems}
          orderedGroups={orderedGroups}
          flatIndexByHref={flatIndexByHref}
          clampedActiveIndex={clampedActiveIndex}
          recentsForBand={recentsForBand}
          showQuickPick={showQuickPick}
          quickPickItems={quickPickItems}
          foldedRecentHref={foldedRecentHref}
          activeItem={activeItem}
          activeGroupLabel={activeGroupLabel}
          activeVerb={activeVerb}
          railVisible={railVisible}
          remoteSearchLoading={remoteSearchLoading}
          remoteSearchFailed={remoteSearchFailed}
          remoteSearchPartial={remoteSearchPartial}
          remoteSearchRecovery={remoteSearchRecovery}
          deferredFilterQ={deferredFilterQ}
          fullSearchHref={fullSearchHref}
          onClose={() => setOpen(false)}
          onQueryChange={handleQueryChange}
          onClearQuery={() => {
            setQuery("");
            clearRemoteSearchFeedback();
            setActiveIndex(0);
          }}
          onRetrySearch={() => {
            setRemoteSearchFailed(false);
            setRemoteSearchRetryNonce((value) => value + 1);
          }}
          onSelectRow={handleSelectRow}
          onActivateRow={(idx) => {
            if (idx >= 0) setActiveIndex(idx);
            setRailVisible(true);
          }}
          onResultsScroll={handleResultsScroll}
        />
      )}
    </>
  );
}
