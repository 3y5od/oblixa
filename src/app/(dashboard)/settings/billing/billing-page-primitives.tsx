import Link from "next/link";
import type { ReactNode } from "react";
import {
  Check,
  CircleDollarSign,
  Clock,
  Download,
  FileText,
  LifeBuoy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ChipPair } from "@/components/ui/chip-pair";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import { isBillingPlaceholder } from "@/lib/billing/states";

export type FactRow = {
  label: string;
  value: ReactNode;
  tabular?: boolean;
  mono?: boolean;
  group?: "facts" | "included";
  included?: boolean;
};

export function IncludedCheck() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
      style={{
        borderColor: "color-mix(in oklab, var(--success-ink) 28%, var(--border-subtle))",
        background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
        color: "var(--success-ink)",
      }}
    >
      <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
    </span>
  );
}

function BillingDlRow({ row }: { row: FactRow }) {
  const isPlaceholder = isBillingPlaceholder(row.value);
  const displayValue: ReactNode = isPlaceholder ? <span aria-label={String(row.value)}>{"\u2014"}</span> : row.value;
  const valueClasses = [
    "min-w-0 text-[13.5px] inline-flex items-center gap-2",
    row.tabular ? "tabular-nums" : "",
    row.mono ? "font-mono text-[12.5px]" : "",
    isPlaceholder ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid gap-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_78%,transparent)] py-3 transition-colors last:border-b-0 hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,transparent)] sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="ui-caps-2 text-[var(--text-tertiary)]">{row.label}</dt>
      <dd className={valueClasses}>
        {row.included ? <IncludedCheck /> : null}
        <span>{displayValue}</span>
      </dd>
    </div>
  );
}

export function BillingDl({ rows }: { rows: ReadonlyArray<FactRow> }) {
  const facts = rows.filter((r) => r.group !== "included");
  const included = rows.filter((r) => r.group === "included");
  return (
    <dl>
      {facts.map((row) => (
        <BillingDlRow key={row.label} row={row} />
      ))}
      {included.length > 0 ? (
        <>
          <div className="pt-5">
            <p className="ui-caps-1 text-[var(--accent)]">{SETTINGS_BILLING_STRINGS.includedEyebrow}</p>
          </div>
          {included.map((row) => (
            <BillingDlRow key={row.label} row={{ ...row, included: true }} />
          ))}
        </>
      ) : null}
    </dl>
  );
}

export const FAQ_ICONS: Record<string, LucideIcon> = {
  "What happens after access review?": Clock,
  "Can I export before cancelling?": Download,
  "When would paid use start?": CircleDollarSign,
  "Can I add more contracts?": FileText,
  "Can I add more team members?": Users,
  "Do you offer setup help?": LifeBuoy,
};

export function TrialChipPair({ caps }: { caps: { contracts: number; teamMembers: number } }) {
  return (
    <span className="inline-flex items-center gap-3 align-middle">
      <span className="inline-flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[var(--text-secondary)]">{caps.contracts}</span>
        <span className="ui-caps-3 text-[var(--text-tertiary)]">contracts</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[var(--text-secondary)]">{caps.teamMembers}</span>
        <span className="ui-caps-3 text-[var(--text-tertiary)]">team members</span>
      </span>
    </span>
  );
}

export function TrialMicrocopyChipPair() {
  return (
    <ChipPair
      primary={SETTINGS_BILLING_STRINGS.trialMicrocopyParts[0]}
      secondary={SETTINGS_BILLING_STRINGS.trialMicrocopyParts[1]}
    />
  );
}

export function BillingHelpActions() {
  return (
    <>
      <Link
        href={SETTINGS_BILLING_STRINGS.contactSalesHref}
        className="ui-btn-secondary inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-[13px]"
      >
        {SETTINGS_BILLING_STRINGS.contactSalesCta}
      </Link>
      <Link
        href={SETTINGS_BILLING_STRINGS.publicPricingHref}
        className="ui-btn-ghost inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-[13px]"
      >
        Review pricing guidance
      </Link>
    </>
  );
}
