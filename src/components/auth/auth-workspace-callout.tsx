import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { CORE_PRICE_LABEL, type AuthCallout } from "./auth-config";
import { QuietFactChip } from "./auth-ui";

/**
 * Quiet offer band under the form card (lighter than a card so it does not read
 * as a competing surface). A small medallion anchors the lead; the
 * request-access action and Core price share one row on the right. Structured
 * facts (login) render as discrete chips on a full-width row below the header so
 * they stay on one line instead of squeezing against the action.
 */
export function AuthWorkspaceCallout({ callout }: { callout: AuthCallout }) {
  return (
    <div className="mt-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_16%,transparent)] px-4 py-3">
      <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_20%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] text-[var(--accent-strong)]"
            aria-hidden
          >
            <KeyRound className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{callout.text}</p>
            {!callout.facts && callout.hint ? (
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">{callout.hint}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0 sm:justify-end">
          {callout.showPrice ? <KeyValueChip label="Core" value={CORE_PRICE_LABEL} /> : null}
          <Link
            href={callout.link}
            className="ui-btn-secondary group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
          >
            {callout.linkText}
            <ArrowRight className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      </div>
      {callout.facts ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:pl-11">
          {callout.facts.map((fact) => (
            <QuietFactChip key={fact}>{fact}</QuietFactChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
