import Link from "next/link";
import type { FieldReviewMiniQueueItem } from "@/lib/field-review/model";

/** In-contract field jump list: the active contract's pending fields as a compact
 *  strip so a reviewer can jump straight to any field without stepping through the
 *  whole sequence or changing contracts. The current field is highlighted; as
 *  fields are decided they drop out of this (pending-only) list, so it naturally
 *  collapses toward done. Hidden when there is nothing to jump between. */
export function ReviewFieldMiniQueue({ items }: { items: FieldReviewMiniQueueItem[] }) {
  if (items.length <= 1) return null;
  return (
    <div>
      <p className="ui-caps-2 mb-1.5 text-[10px] leading-none text-[var(--text-tertiary)]">
        Other details needing review in this contract
      </p>
      <div className="-mx-0.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) =>
          item.isCurrent ? (
            <span
              key={item.id}
              aria-current="true"
              className="inline-flex shrink-0 items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_34%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--accent-strong)]"
            >
              {item.label}
            </span>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className="ui-chip-focus inline-flex shrink-0 items-center rounded-full border border-[var(--border-card)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-medium leading-none text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              {item.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
