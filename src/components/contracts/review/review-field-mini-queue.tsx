import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FieldReviewMiniQueueItem } from "@/lib/field-review/model";

/** In-contract detail selector: the active contract's remaining pending details
 *  as a compact low-radius segmented strip so a reviewer can jump straight to any
 *  detail without stepping through the whole sequence or changing contracts. The
 *  current detail is filled (selected), the rest are quiet bordered cells with a
 *  stable height; as details are decided they drop out of this (pending-only)
 *  list, so it naturally collapses toward done. Hidden when there is nothing to
 *  jump between. */
export function ReviewFieldMiniQueue({ items }: { items: FieldReviewMiniQueueItem[] }) {
  if (items.length <= 1) return null;
  return (
    <div>
      <p className="mb-2 text-[11.5px] font-semibold leading-none text-[var(--text-secondary)]">
        Details needing review in this contract
      </p>
      <div className="-mx-0.5 flex flex-nowrap items-stretch gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) =>
          item.isCurrent ? (
            // Current detail — a neutral "selected" cell (firm border + cool fill
            // + ink, marked by the arrow) rather than a saturated blue chip, so
            // cobalt stays reserved for the decision path.
            <span
              key={item.id}
              aria-current="true"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-cool-strong)_72%,var(--surface-raised))] px-2.5 py-1.5 text-[11.5px] font-semibold leading-none text-[var(--text-primary)]"
            >
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
              {item.label}
              <span className="sr-only">, currently reviewing</span>
            </span>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className="ui-chip-focus inline-flex shrink-0 items-center rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[11.5px] font-medium leading-none text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              {item.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
