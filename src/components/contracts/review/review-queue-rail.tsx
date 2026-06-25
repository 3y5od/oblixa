import Link from "next/link";
import { ChevronRight, FileWarning, Search, SearchX } from "lucide-react";
import { CountChip } from "@/components/ui/count-chip";
import { ActionChip } from "@/components/ui/action-chip";
import { formatRelativeReadable } from "@/lib/ui-copy";
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

export function ReviewQueueRow({
  item,
  isActive,
  hrefSuffix = "",
}: {
  item: FieldReviewQueueItem;
  isActive: boolean;
  hrefSuffix?: string;
}) {
  const attention = !item.hasSourceText || item.nextNeedsCitation;
  const attentionLabel = !item.hasSourceText ? "Source preview unavailable" : "Next detail needs source text";
  const detailWord = item.pendingFields === 1 ? "detail" : "details";
  const rel = formatRelativeReadable(item.updatedAt);
  const updatedText =
    rel === "—"
      ? "Updated date unknown"
      : rel === "just now"
        ? "Updated just now"
        : /(min|hr|d)$/.test(rel)
          ? `Updated ${rel} ago`
          : `Updated ${rel}`;
  const updatedIso = (() => {
    const d = new Date(item.updatedAt);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  })();
  return (
    <Link
      href={`${item.href}${hrefSuffix}`}
      title={item.title}
      aria-current={isActive ? "page" : undefined}
      aria-label={`${item.title}${item.counterparty ? `, ${item.counterparty}` : ""}, owner ${item.ownerLabel}, ${item.pendingFields} suggested ${detailWord} to review${attention ? `, ${attentionLabel}` : ""}${isActive ? ", currently reviewing" : ""}`}
      className={`ui-chip-focus group flex flex-col gap-1 border-l-[3px] px-3 py-2.5 transition-colors ${
        isActive
          ? "border-l-[var(--accent-strong)] bg-[color:color-mix(in_oklab,var(--surface-cool-strong)_42%,var(--surface-raised))]"
          : "border-l-transparent bg-[var(--surface-raised)] hover:border-l-[var(--border-strong)] hover:bg-[color:color-mix(in_oklab,var(--surface-cool)_30%,var(--surface-raised))]"
      }`}
    >
      <span className="flex items-baseline gap-2">
        {isActive ? <span className="sr-only">Currently reviewing: </span> : null}
        <span
          className={`line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-snug ${isActive ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-primary)]"}`}
        >
          {item.title}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{item.pendingFields}</span> to review
        </span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[11.5px] leading-tight text-[var(--text-secondary)]">
          <span className="sr-only">Counterparty </span>
          {item.counterparty ?? "No counterparty"}
          <span aria-hidden className="text-[var(--text-tertiary)]"> · </span>
          <span className="sr-only">Owner </span>
          <span className="text-[var(--text-tertiary)]">{item.ownerLabel}</span>
        </span>
        {isActive ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-semibold leading-none text-[var(--text-primary)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
            Reviewing
          </span>
        ) : attention ? (
          <span className="inline-flex min-w-0 shrink items-center gap-1 text-[10.5px] font-medium leading-none text-[var(--warning-ink)]">
            <FileWarning className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate">{!item.hasSourceText ? "No source preview" : "Needs source text"}</span>
          </span>
        ) : (
          <span
            className="shrink-0 whitespace-nowrap text-[11px] leading-none tabular-nums text-[var(--text-tertiary)]"
            title={updatedIso}
          >
            {updatedText}
          </span>
        )}
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
  const ownerGroups = groupQueueByOwner(renderQueue);
  const showOwnerGroups = queueIsFiltered && ownerGroups.length > 1;
  const queueParamSuffix = buildQueueParamSuffix(queueFilter, queueSearch);

  const clearFiltersHref = buildReviewHref({ page: safePage, contract: activeContractId, field: activeFieldId });
  const renderFilterRow = (key: ReviewQueueFilter) => {
    const isActive = key === queueFilter;
    const count = filterCounts[key];
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
        aria-current={isActive ? "true" : undefined}
        aria-label={`${filterLabel(key)}: ${count} ${count === 1 ? "contract" : "contracts"}`}
        className={`ui-chip-focus flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-[12.5px] leading-none transition-colors ${
          isActive
            ? "bg-[color:color-mix(in_oklab,var(--surface-cool)_48%,var(--surface-raised))] font-semibold text-[var(--text-primary)]"
            : "font-medium text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-cool)_30%,var(--surface-raised))] hover:text-[var(--text-primary)]"
        }`}
      >
        <span className="min-w-0 truncate">{filterLabel(key)}</span>
        <span
          className={`shrink-0 tabular-nums ${
            isActive
              ? "text-[var(--text-primary)]"
              : count === 0
                ? "text-[var(--text-tertiary)]"
                : "text-[var(--text-secondary)]"
          }`}
        >
          {count}
        </span>
      </Link>
    );
  };

  return (
    <details
      open
      className="group/queue border-t border-[var(--border-subtle)] px-5 py-4 sm:px-6 lg:col-span-2 lg:row-start-3 lg:py-5 xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:border-t-0"
    >
      <summary className="ui-chip-focus flex cursor-pointer list-none items-baseline justify-between gap-2 rounded border-b border-[var(--border-subtle)] pb-2.5 marker:hidden xl:cursor-default [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
          Review contracts
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 translate-y-0.5 text-[var(--text-tertiary)] transition-transform group-open/queue:rotate-90 xl:hidden"
          strokeWidth={2}
          aria-hidden
        />
      </summary>

      <p className="mt-2.5 text-[12px] leading-snug text-[var(--text-tertiary)]">
        Contracts with suggested details that are not trusted yet.
      </p>

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
            <Search className="h-4 w-4" strokeWidth={2} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={queueSearch}
            maxLength={120}
            placeholder="Search contracts"
            aria-label="Search contracts to review by name, counterparty, or owner"
            className="ui-input-compact min-h-10 w-full rounded-lg pl-9 text-[13px]"
          />
        </div>
      </form>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          <p className="px-2 text-[10.5px] font-medium uppercase tracking-[0.04em] leading-none text-[var(--text-tertiary)]">
            Filter contracts
          </p>
          <div className="flex flex-col gap-1" role="group" aria-label="Filter contracts by view">
            {PRIMARY_FILTERS.map((key) => renderFilterRow(key))}
          </div>
        </div>
        <div className="space-y-1 border-t border-[var(--border-card)] pt-3">
          <p className="px-2 text-[10.5px] font-medium uppercase tracking-[0.04em] leading-none text-[var(--text-tertiary)]">
            Source
          </p>
          <div className="flex flex-col gap-1" role="group" aria-label="Filter contracts by source state">
            {ISSUE_FILTERS.map((key) => renderFilterRow(key))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-[var(--border-strong)] pt-3 xl:shrink-0">
        <p className="text-[12.5px] font-semibold leading-none text-[var(--text-primary)]">Contracts to review</p>
        <span className="text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{filteredQueue.length}</span>{" "}
          {queueIsFiltered ? "matching" : filteredQueue.length === 1 ? "contract" : "contracts"}
        </span>
      </div>

      {filteredQueue.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-muted)_35%,var(--surface))] px-4 py-6 text-center">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-card)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
          >
            <SearchX className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <p className="text-[12px] font-medium leading-none text-[var(--text-secondary)]">No matching contracts</p>
          <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
            No contracts match the current filter or search.
          </p>
          <Link
            href={clearFiltersHref}
            className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px]"
          >
            Clear filters
          </Link>
        </div>
      ) : showOwnerGroups ? (
        <div className="ui-scroll-subtle mt-2.5 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
          {ownerGroups.map((group) => (
            <div key={group.owner}>
              <p className="mb-1.5 flex items-center gap-1.5">
                <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.06em] leading-none text-[var(--text-tertiary)]">
                  {group.owner}
                </span>
                <CountChip value={group.items.length} emphasis="subtle" />
              </p>
              <ul className="divide-y divide-[var(--border-card)] overflow-hidden rounded-lg border border-[var(--border-card)]">
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
        <ul className="ui-scroll-subtle mt-2.5 grid grid-cols-1 gap-x-3 divide-y divide-[var(--border-card)] overflow-hidden rounded-lg border border-[var(--border-card)] sm:grid-cols-2 sm:divide-y-0 sm:[&>li]:border-b sm:[&>li]:border-[var(--border-card)] xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:divide-y xl:overflow-y-auto xl:[&>li]:border-b-0">
          {renderQueue.map((item) => (
            <li key={item.id}>
              <ReviewQueueRow item={item} isActive={item.id === activeContractId} hrefSuffix={queueParamSuffix} />
            </li>
          ))}
        </ul>
      )}
      {filteredQueue.length > 0 && (totalDisplayPages > 1 || hasMore || queueIsFiltered) ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2.5 xl:shrink-0">
          {totalDisplayPages > 1 ? (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-[11px] leading-none tabular-nums text-[var(--text-tertiary)]">
                Page <span className="font-semibold text-[var(--text-secondary)]">{currentDisplayPage}</span> of{" "}
                {totalDisplayPages}
              </span>
              <span className="text-[11px] leading-none text-[var(--text-tertiary)]">·</span>
              <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
                {renderQueue.length}
              </span>
              <span className="text-[11px] leading-none text-[var(--text-tertiary)]">of {filteredQueue.length}</span>
            </span>
          ) : (
            <span aria-hidden />
          )}
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
