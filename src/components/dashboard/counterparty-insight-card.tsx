import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { formatRelativeCompact } from "@/lib/ui-copy";

export interface CounterpartyInsightCardProps {
  name: string;
  contractCount: number;
  annualValueTotal?: number | null;
  latestUpdatedAt?: string | null;
  href: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function CounterpartyInsightCard({
  name,
  contractCount,
  annualValueTotal,
  latestUpdatedAt,
  href,
}: CounterpartyInsightCardProps) {
  return (
    <Link
      href={href}
      className="ui-card-interactive group flex flex-col gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))]"
    >
      <header className="flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Top counterparty
        </p>
      </header>
      <div>
        <p className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
          {name}
        </p>
        <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums text-[var(--text-secondary)]">
          <span className="text-[var(--text-tertiary)]">CONTRACTS</span>
          <span className="text-[var(--text-primary)]">{contractCount}</span>
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {annualValueTotal != null && annualValueTotal > 0 ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              ANNUAL VALUE
            </dt>
            <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
              {formatCurrency(annualValueTotal)}
            </dd>
          </div>
        ) : null}
        {latestUpdatedAt ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              LAST ACTIVITY
            </dt>
            <dd className="mt-0.5 text-[14px] font-semibold uppercase tracking-[0.06em] tabular-nums text-[var(--text-secondary)]">
              {formatRelativeCompact(latestUpdatedAt)}
            </dd>
          </div>
        ) : null}
      </dl>
      <span className="mt-auto inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
        VIEW CONTRACTS
        <ChevronRight
          className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.85}
          aria-hidden
        />
      </span>
    </Link>
  );
}
