import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { Contract } from "@/lib/types";

interface MissingFieldsSectionProps {
  contracts: Pick<Contract, "id" | "title" | "counterparty">[];
}

export function MissingFieldsSection({ contracts }: MissingFieldsSectionProps) {
  if (contracts.length === 0) return null;

  const visible = contracts.slice(0, 4);
  const overflow = Math.max(0, contracts.length - visible.length);

  return (
    <section
      id="missing-critical"
      role="region"
      aria-labelledby="missing-critical-heading"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-l-[2px] border-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_18%,var(--surface-raised))] px-4 py-3"
      style={{
        borderLeftColor: "color-mix(in oklab, var(--warning-ink) 80%, transparent)",
      }}
    >
      <TriangleAlert
        className="h-4 w-4 shrink-0 text-[var(--warning-ink)]"
        strokeWidth={1.85}
        aria-hidden
      />
      <span
        id="missing-critical-heading"
        className="inline-flex h-[22px] items-center gap-1 self-center rounded-full border border-[color:color-mix(in_oklab,var(--warning-ink)_32%,var(--border-card))] bg-[var(--surface-raised)] px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--warning-ink)]"
      >
        <span className="tabular-nums">{contracts.length}</span>
        <span>{contracts.length === 1 ? "MISSING DATE" : "MISSING DATES"}</span>
      </span>
      {visible.map((c) => (
        <Link
          key={c.id}
          href={`/contracts/${c.id}`}
          className="inline-flex h-[22px] max-w-[14rem] items-center gap-1 self-center rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_40%,var(--border-card))] bg-transparent px-2 text-[11px] font-semibold leading-none text-[var(--text-primary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--warning-ink)_45%,var(--border-strong))]"
          title={c.title}
        >
          <span className="truncate">{c.title}</span>
        </Link>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex h-[22px] items-center self-center rounded-full border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none tabular-nums text-[var(--text-tertiary)]">
          +{overflow} MORE
        </span>
      ) : null}
      <span
        aria-hidden
        className="ml-auto inline-block h-4 w-px self-center"
        style={{
          background:
            "color-mix(in oklab, var(--warning-soft) 50%, transparent)",
        }}
      />
      {/* v11 visual pass: row-level button → chevron link, matching the
          chevron pattern used by Review Queue / Recent Activity rows.
          Section-header "Fix missing data" link still carries the bulk action. */}
      <Link
        href={contracts.length === 1 ? `/contracts/${contracts[0]!.id}` : "/contracts/review"}
        aria-label={contracts.length === 1 ? "Open contract to fix missing dates" : "Open review queue to fix missing dates"}
        className="group inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[var(--accent-strong)] transition-transform hover:translate-x-0.5"
      >
        <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
      </Link>
    </section>
  );
}
