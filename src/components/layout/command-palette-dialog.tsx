"use client";

import { createElement, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { WorkspaceRole } from "@/lib/navigation";
import { shellTestIds } from "@/lib/qa/test-ids";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { ResultRow } from "@/components/search/result-row";
import { SearchField, type SearchFieldHandle } from "@/components/search/search-field";
import { resolveNavIcon } from "@/components/search/nav-icon";
import { paletteHrefKey, type CommandPaletteRecovery, type PaletteItem } from "./command-palette-helpers";

type CommandPaletteGroup = { key: string; label: string; items: PaletteItem[] };

type CommandPaletteDialogProps = {
  fieldRef: RefObject<SearchFieldHandle | null>; role: WorkspaceRole; query: string; hasQuery: boolean;
  announcement: string; flatItems: PaletteItem[]; orderedGroups: CommandPaletteGroup[];
  flatIndexByHref: Map<string, number>; clampedActiveIndex: number; recentsForBand: PaletteItem[] | null;
  showQuickPick: boolean; quickPickItems: PaletteItem[]; foldedRecentHref: string | null;
  activeItem: PaletteItem | null; activeGroupLabel: string; activeVerb: string; railVisible: boolean;
  remoteSearchLoading: boolean; remoteSearchFailed: boolean; remoteSearchPartial: string | null;
  remoteSearchRecovery: CommandPaletteRecovery | null; deferredFilterQ: string; fullSearchHref: string;
  onClose: () => void; onQueryChange: (query: string) => void; onClearQuery: () => void; onRetrySearch: () => void;
  onSelectRow: (item: PaletteItem) => void; onActivateRow: (index: number) => void; onResultsScroll: () => void;
};

function overlayMetaOverride(item: PaletteItem): string | undefined {
  if (item.resultOrder != null) return undefined;
  return item.href.split("?")[0] ?? item.href;
}

function FooterHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
      <kbd className="ui-kbd">{keys}</kbd>
      {label}
    </span>
  );
}

function GroupHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="ui-command-group-head">
      <span className="ui-caps-2 text-[var(--text-tertiary)]">{label}</span>
      {count >= 1 ? (
        <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
          <span className="sr-only">{count} result{count === 1 ? "" : "s"}</span>
          <span aria-hidden>{count}</span>
        </span>
      ) : null}
    </div>
  );
}

export function CommandPaletteDialog({
  fieldRef,
  role,
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
  onClose,
  onQueryChange,
  onClearQuery,
  onRetrySearch,
  onSelectRow,
  onActivateRow,
  onResultsScroll,
}: CommandPaletteDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid={shellTestIds.commandPaletteRoot}
      className="ui-overlay-scrim fixed inset-0 z-50 flex items-start justify-center px-3 pt-[8vh] sm:px-4 sm:pt-[11vh]"
    >
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close command palette overlay" />
      <div
        className="ui-command-modal relative flex w-full max-w-3xl flex-col lg:max-w-[56rem]"
        style={{ maxHeight: "min(33rem, calc(100dvh - 9rem))" }}
      >
        <div className="ui-command-search shrink-0">
          <SearchField
            ref={fieldRef}
            variant="overlay"
            isOpen
            isCombobox={false}
            value={query}
            onChange={onQueryChange}
            onClear={onClearQuery}
            placeholder="Search pages, queues, reports, tools"
            ariaLabel="Search pages, queues, reports, tools"
            ariaControls="command-palette-results"
            ariaKeyShortcuts="ArrowUp ArrowDown Enter Escape"
            testId={shellTestIds.commandPaletteInput}
            trailing={
              hasQuery ? (
                <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                  <span className="sr-only">{flatItems.length} result{flatItems.length === 1 ? "" : "s"}</span>
                  <span aria-hidden>{flatItems.length}</span>
                </span>
              ) : null
            }
          />
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {hasQuery ? announcement : ""}
        </div>
        {remoteSearchPartial ? (
          <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-2 sm:px-5">
            <RecoverableState
              state="partial"
              title="Command search is partially available"
              reason={remoteSearchRecovery?.message ?? remoteSearchPartial}
              accessibleName="Command palette partial search state"
              surface="command_palette"
              section="remote_search"
              sourceObject="setting_destination"
              diagnosticId={remoteSearchRecovery?.diagnosticId}
              nextActionLabel="Review recovery destination"
              className="border-0 bg-transparent p-0"
              nextAction={(remoteSearchRecovery?.actions ?? [{ label: "Review workspace health", href: "/settings/health" }]).slice(0, 2).map((action) => (
                <Link key={action.href} href={action.href} onClick={onClose} className="ui-link inline-flex">
                  {action.label}
                </Link>
              ))}
            />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-auto">
          <div className="flex min-h-0 flex-auto flex-col">
            <ul
              id="command-palette-results"
              data-testid={shellTestIds.commandPaletteResults}
              onScroll={onResultsScroll}
              className="ui-command-scroll min-h-0 flex-auto overflow-y-auto pb-4 pt-1"
            >
              {remoteSearchLoading && deferredFilterQ.length >= 2 ? (
                <li className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] text-[var(--text-tertiary)]">
                  <span
                    aria-hidden
                    className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)] motion-reduce:animate-none"
                  />
                  Searching contracts...
                </li>
              ) : null}
              {flatItems.length === 0 && !remoteSearchLoading ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--text-secondary)] sm:px-5">
                  <RecoverableState
                    state={remoteSearchFailed ? "failed" : "empty"}
                    title={remoteSearchFailed ? "Command search could not load." : (remoteSearchRecovery?.message ?? "No matches found.")}
                    reason={
                      remoteSearchFailed
                        ? "Retry command search or open workspace health for recovery diagnostics."
                        : "No eligible command destination matched this query. Search contracts or use a recovery destination."
                    }
                    accessibleName={remoteSearchFailed ? "Command palette failed search state" : "Command palette empty search state"}
                    surface="command_palette"
                    section="zero_results"
                    sourceObject="setting_destination"
                    diagnosticId={remoteSearchRecovery?.diagnosticId}
                    nextActionLabel={remoteSearchFailed ? "Retry command search" : "Search contracts for this query"}
                    className="border-0 bg-transparent p-0"
                    nextAction={
                      <>
                        {remoteSearchFailed ? (
                          <button
                            type="button"
                            onClick={onRetrySearch}
                            className="ui-btn-secondary min-h-9 rounded-full px-3 text-xs"
                          >
                            Retry search
                          </button>
                        ) : null}
                        {remoteSearchFailed || remoteSearchRecovery ? (
                          <Link href="/settings/health" onClick={onClose} className="ui-link inline-flex">
                            Review workspace health
                          </Link>
                        ) : null}
                        {remoteSearchRecovery
                          ? remoteSearchRecovery.actions.map((action) => (
                              <Link
                                key={`${action.href}:${action.reason ?? "recovery"}`}
                                href={action.href}
                                onClick={onClose}
                                className="ui-btn-secondary min-h-9 rounded-full px-3 text-xs"
                              >
                                {action.label}
                              </Link>
                            ))
                          : null}
                        <Link
                          href={`/contracts?search=${encodeURIComponent(query.trim())}`}
                          onClick={onClose}
                          className="ui-link inline-flex"
                        >
                          Search contracts for this query
                        </Link>
                      </>
                    }
                    noActionExplanation={remoteSearchRecovery ? undefined : "Recovery action: route to eligible contract search instead of leaving a blank panel."}
                  />
                </li>
              ) : flatItems.length === 0 ? null : (
                <>
                  {recentsForBand ? (
                    <li>
                      <GroupHead label="Recent" count={recentsForBand.length} />
                      <ul>
                        {recentsForBand.map((item) => (
                          <li key={`recent-${item.href}`}>
                            <ResultRow item={item} role={role} metaOverride={overlayMetaOverride(item)} onSelect={() => onSelectRow(item)} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null}
                  {showQuickPick && quickPickItems.length > 0 ? (
                    <li>
                      <GroupHead label="Quick pick" count={0} />
                      <div className="flex flex-wrap gap-1.5 px-4 pb-2.5 pt-1">
                        {quickPickItems.map((item) => (
                          <Link
                            key={`quick-${item.href}`}
                            href={item.href}
                            onClick={() => onSelectRow(item)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
                          >
                            <span aria-hidden className="text-[var(--accent-strong)]">
                              {createElement(resolveNavIcon(item), { className: "h-3.5 w-3.5", strokeWidth: 1.85 })}
                            </span>
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </li>
                  ) : null}
                  {orderedGroups.map((section) => (
                    <li key={section.key}>
                      <GroupHead label={section.label} count={section.items.length} />
                      <ul>
                        {section.items.map((item) => {
                          const idx = flatIndexByHref.get(item.href) ?? -1;
                          const active = idx === clampedActiveIndex;
                          const isRecent =
                            !active &&
                            foldedRecentHref !== null &&
                            paletteHrefKey(item.href) === foldedRecentHref;
                          return (
                            <li key={item.href}>
                              <ResultRow
                                item={item}
                                role={role}
                                query={hasQuery ? query : undefined}
                                isActive={active}
                                isRecent={isRecent}
                                metaOverride={overlayMetaOverride(item)}
                                onSelect={() => onSelectRow(item)}
                                onActivate={() => onActivateRow(idx)}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>
          <aside className="hidden w-[16rem] shrink-0 flex-col overflow-y-auto border-l border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-4 lg:flex">
            {activeItem && railVisible ? (
              <>
                <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]">
                  {createElement(resolveNavIcon(activeItem), { className: "h-[1.125rem] w-[1.125rem]", strokeWidth: 1.85 })}
                </span>
                <p className="mt-3 text-[15px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">{activeItem.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{activeGroupLabel}</span>
                  <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">{activeVerb}</span>
                </div>
                {activeItem.description ? <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{activeItem.description}</p> : null}
                <p className="mt-3 break-all font-mono text-[11px] text-[var(--text-tertiary)]">{activeItem.href}</p>
                <Link
                  href={activeItem.href}
                  onClick={() => onSelectRow(activeItem)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_35%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_48%,var(--surface-raised))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
                >
                  {activeVerb}
                  <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
                </Link>
              </>
            ) : (
              <div className="m-auto text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Keyboard</p>
                <div className="mt-2.5 flex flex-col gap-2 text-[11px] text-[var(--text-tertiary)]">
                  <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">↑↓</kbd> Move</span>
                  <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">Enter</kbd> Open</span>
                  <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">Esc</kbd> Close</span>
                </div>
              </div>
            )}
          </aside>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-tint)] px-3 py-2.5 sm:px-4">
          <div className="hidden items-center gap-3 sm:flex">
            <FooterHint keys="↑↓" label="Move" />
            <FooterHint keys="Enter" label="Open" />
            <FooterHint keys="Esc" label="Close" />
          </div>
          <Link
            href={fullSearchHref}
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-[11.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
          >
            Open full search
            <ArrowRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
