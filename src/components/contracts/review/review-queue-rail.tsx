import Link from "next/link";
import { ChevronRight, FileWarning, ListChecks, Search, SearchX } from "lucide-react";
import { TimeChip } from "@/components/ui/time-chip";
import { CountChip } from "@/components/ui/count-chip";
import { ActionChip } from "@/components/ui/action-chip";
import {
  filterReviewQueueItems,
  reviewQueueFilterCounts,
  REVIEW_QUEUE_FILTERS,
  type FieldReviewQueueItem,
  type ReviewQueueFilter,
} from "@/lib/field-review/model";
import { buildQueueParamSuffix, buildReviewHref, groupQueueByOwner } from "./review-helpers";

const PRIMARY_FILTERS: ReviewQueueFilter[] = ["all", "mine", "key"];
const ISSUE_FILTERS: ReviewQueueFilter[] = ["no-source", "needs-citation"];

function filterLabel(key: ReviewQueueFilter): string {
  return REVIEW_QUEUE_FILTERS.find((f) => f.key === key)?.label ?? key;
}

/** Two-line queue row: title (+ reserved attention slot + pending count), then a
 *  CURRENT tag/counterparty/owner + relative updated time, with a per-contract
 *  confirmation mini-bar at the bottom. Active row carries a left accent rail + tint. */
export function ReviewQueueRow({
  item,
  isActive,
  hrefSuffix = "",
}: {
  item: FieldReviewQueueItem;
  isActive: boolean;
  hrefSuffix?: string;
}) {
  const reviewed = Math.max(0, item.totalFields - item.pendingFields);
  const pct = item.totalFields > 0 ? Math.round((reviewed / item.totalFields) * 100) : 0;
  const attention = !item.hasSourceText || item.nextNeedsCitation;
  const attentionLabel = !item.hasSourceText ? "Source preview unavailable" : "Next detail needs source text";
  const meta = item.counterparty ?? item.ownerLabel;
  return (
    <Link
      href={`${item.href}${hrefSuffix}`}
      title={item.title}
      aria-current={isActive ? "page" : undefined}
      aria-label={`${item.title}, ${item.pendingFields} ${item.pendingFields === 1 ? "detail" : "details"} pending`}
      className={`ui-chip-focus group flex flex-col gap-1.5 rounded-lg border border-l-2 px-2.5 py-2.5 transition-colors ${
        isActive
          ? "border-[var(--border-subtle)] border-l-[var(--accent)] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))]"
          : "border-[var(--border-card)] border-l-transparent bg-[var(--surface-raised)] hover:border-[var(--border-strong)] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_9%,var(--surface-raised))]"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: isActive ? "var(--accent)" : "transparent" }}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {item.title}
        </span>
        {/* Reserved attention slot — fixed width keeps titles aligned (§10.9). */}
        <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
          {attention ? (
            <FileWarning className="h-3 w-3 text-[var(--warning-ink)]" strokeWidth={2} aria-label={attentionLabel} />
          ) : null}
        </span>
        <CountChip value={item.pendingFields} emphasis="strong" />
      </span>
      <span className="flex items-center gap-2 pl-3.5">
        {isActive ? (
          <span className="ui-caps-3 inline-flex shrink-0 items-center rounded-[4px] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] px-1 py-0.5 text-[9px] leading-none text-[var(--accent-strong)]">
            Current
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-tertiary)]">{meta}</span>
        <TimeChip date={item.updatedAt} format="relative" className="shrink-0 text-[var(--text-tertiary)]" />
      </span>
      <span
        className="ml-3.5 h-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-strong)_45%,transparent)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${reviewed} of ${item.totalFields} details confirmed`}
      >
        <span
          aria-hidden
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: isActive ? "var(--accent)" : "color-mix(in oklab, var(--accent) 55%, transparent)",
          }}
        />
      </span>
    </Link>
  );
}

interface ReviewQueueRailProps {
  queue: FieldReviewQueueItem[];
  page: number;
  pageSize: number;
  activeContractId: string;
  activeFieldId: string;
  viewerId: string;
  queueFilter: ReviewQueueFilter;
  queueSearch: string;
}

/** Persistent "what's next" list. Scrolls within the rail on lg; below the panes
 *  on md; collapsible on mobile. Filtering + counts run over the FULL workspace
 *  queue (cross-page). */
export function ReviewQueueRail({
  queue,
  page,
  pageSize,
  activeContractId,
  activeFieldId,
  viewerId,
  queueFilter,
  queueSearch,
}: ReviewQueueRailProps) {
  const queueIsFiltered = queueFilter !== "all" || queueSearch.length > 0;
  const filteredQueue = filterReviewQueueItems(queue, {
    filter: queueFilter,
    q: queueSearch,
    viewerId,
  });
  const filterCounts = reviewQueueFilterCounts(queue, viewerId);
  const safePage = Math.max(1, page);
  const renderQueue = filteredQueue.slice(0, safePage * pageSize);
  const hasMore = renderQueue.length < filteredQueue.length;
  const totalDisplayPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const currentDisplayPage = Math.min(safePage, totalDisplayPages);
  // Group by owner only within a filtered view — the unfiltered queue keeps its
  // intentional ranked order (pending_review → count → age).
  const ownerGroups = groupQueueByOwner(renderQueue);
  const showOwnerGroups = queueIsFiltered && ownerGroups.length > 1;
  const queueParamSuffix = buildQueueParamSuffix(queueFilter, queueSearch);

  const clearFiltersHref = buildReviewHref({ page: safePage, contract: activeContractId, field: activeFieldId });

  const renderChip = (key: ReviewQueueFilter, tone: "primary" | "issue") => {
    const isActive = key === queueFilter;
    const count = filterCounts[key];
    const dim = tone === "issue" && count === 0 && !isActive;
    return (
      <Link
        key={key}
        href={buildReviewHref({
          page: safePage,
          contract: activeContractId,
          field: activeFieldId,
          qf: key,
          q: queueSearch,
        })}
        aria-pressed={isActive}
        className={`ui-chip-focus inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors ${
          isActive && tone === "issue"
            ? "border-[color:color-mix(in_oklab,var(--warning)_36%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface-raised))] text-[var(--warning-ink)]"
            : isActive
              ? "border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
              : `border-[var(--border-card)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] ${dim ? "opacity-55" : ""}`
        }`}
      >
        {filterLabel(key)}
        <span
          className="font-mono text-[10px] tabular-nums"
          style={
            tone === "issue" && count > 0 && !isActive ? { color: "var(--warning-ink)", opacity: 0.9 } : { opacity: 0.8 }
          }
        >
          {count}
        </span>
      </Link>
    );
  };

  return (
    <details
      open
      className="group/queue border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)] px-5 py-4 sm:px-6 md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-t-0 lg:bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)] lg:py-5"
    >
      <summary className="ui-chip-focus flex cursor-pointer list-none items-center gap-2 rounded marker:hidden lg:cursor-default [&::-webkit-details-marker]:hidden">
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Contracts needing review</p>
        <CountChip value={queue.length} emphasis="subtle" />
        <ChevronRight
          className="ml-auto h-4 w-4 text-[var(--text-tertiary)] transition-transform group-open/queue:rotate-90 lg:hidden"
          strokeWidth={2}
          aria-hidden
        />
      </summary>

      {/* Search — GET form preserves the active decision + filter. */}
      <form method="get" action="/contracts/review" role="search" className="mt-3">
        {safePage > 1 ? <input type="hidden" name="page" value={safePage} /> : null}
        <input type="hidden" name="contract" value={activeContractId} />
        <input type="hidden" name="field" value={activeFieldId} />
        {queueFilter !== "all" ? <input type="hidden" name="qf" value={queueFilter} /> : null}
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-tertiary)]"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={queueSearch}
            maxLength={120}
            placeholder="Search contracts"
            aria-label="Search contracts to review"
            className="ui-input-compact w-full pl-8 text-[12.5px]"
          />
        </div>
      </form>

      {/* Filters — primary scope (row 1) over secondary issue chips (row 2).
          Horizontally scrollable on narrow widths instead of wrapping dense. */}
      <div className="mt-2.5 space-y-1.5">
        <div className="-mx-0.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
          {PRIMARY_FILTERS.map((key) => renderChip(key, "primary"))}
        </div>
        <div className="-mx-0.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
          <span className="ui-caps-3 shrink-0 pr-0.5 text-[9px] leading-none text-[var(--text-tertiary)]">Source</span>
          {ISSUE_FILTERS.map((key) => renderChip(key, "issue"))}
        </div>
      </div>

      {/* Rows — grouped by owner within a filtered view, flat ranked otherwise. */}
      {filteredQueue.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-muted)_35%,var(--surface))] px-4 py-6 text-center">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-card)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
          >
            <SearchX className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">No matches</p>
          <Link
            href={clearFiltersHref}
            className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
          >
            Clear filters
          </Link>
        </div>
      ) : showOwnerGroups ? (
        <div className="mt-3 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {ownerGroups.map((group) => (
            <div key={group.owner}>
              <p className="mb-1.5 flex items-center gap-1.5">
                <span className="ui-caps-3 min-w-0 truncate text-[10px] leading-none text-[var(--text-tertiary)]">
                  {group.owner}
                </span>
                <CountChip value={group.items.length} emphasis="subtle" />
              </p>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <ReviewQueueRow
                      item={item}
                      isActive={item.id === activeContractId}
                      hrefSuffix={queueParamSuffix}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1.5 lg:overflow-y-auto lg:pr-1">
          {renderQueue.map((item) => (
            <li key={item.id}>
              <ReviewQueueRow item={item} isActive={item.id === activeContractId} hrefSuffix={queueParamSuffix} />
            </li>
          ))}
        </ul>
      )}

      {/* Footer — page position + match count, with show more / clear filters. */}
      {filteredQueue.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2.5">
          <span className="inline-flex items-baseline gap-1.5">
            {totalDisplayPages > 1 ? (
              <span className="ui-caps-3 text-[10px] leading-none tabular-nums text-[var(--text-tertiary)]">
                Page <span className="text-[var(--text-secondary)]">{currentDisplayPage}</span> of {totalDisplayPages}
              </span>
            ) : (
              <span className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Showing</span>
            )}
            <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
              {renderQueue.length}
            </span>
            <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">of</span>
            <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
              {filteredQueue.length}
            </span>
          </span>
          {hasMore ? (
            <ActionChip
              verb="Show more"
              href={buildReviewHref({
                page: safePage + 1,
                contract: activeContractId,
                field: activeFieldId,
                qf: queueFilter,
                q: queueSearch,
              })}
              className="ui-chip-focus"
            />
          ) : queueIsFiltered ? (
            <Link href={clearFiltersHref} className="ui-link text-[12px]">
              Clear filters
            </Link>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
