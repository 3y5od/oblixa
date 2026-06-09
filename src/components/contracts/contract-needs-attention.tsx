import { Check, ListChecks } from "lucide-react";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { CountChip } from "@/components/ui/count-chip";

type AttentionItem = {
  key: string;
  kind: string;
  count: number;
  verb: string;
  href: string;
  label: string;
  tone: "warning" | "danger";
};

/**
 * Right-rail setup-gap + blocker list. Severity-sorted full-width capsules
 * (count → action, §10.13); affirmative "All clear" when empty (§10.10).
 */
export function ContractNeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 px-1">
        <ListChecks className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <p className="ui-caps-3 text-[var(--text-tertiary)]">Needs attention</p>
        {items.length > 0 ? <CountChip value={items.length} /> : null}
      </div>
      <div className="mt-2 border-t border-[var(--border-subtle)]">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-3">
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border"
              style={{
                borderColor: "color-mix(in oklab, var(--success-ink) 28%, var(--border-subtle))",
                background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface-raised))",
                color: "var(--success-ink)",
              }}
            >
              <Check className="h-3 w-3" strokeWidth={2.2} />
            </span>
            <p className="text-[12.5px] font-medium text-[color:color-mix(in_oklab,var(--success-ink)_55%,var(--text-secondary))]">
              All clear
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 py-1.5">
            {items.map((item) => (
              <li key={item.key} className="flex">
                <ChipCapsule
                  leftValue={item.count}
                  leftLabel={item.kind}
                  rightVerb={item.verb}
                  href={item.href}
                  tone={item.tone}
                  className="w-full"
                  ariaLabel={item.label}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
