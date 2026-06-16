import { UserX } from "lucide-react";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COUNTERPARTY_FALLBACK_TOKENS = new Set([
  "tenants",
  "tenant",
  "vendor",
  "counterparty",
  "supplier",
  "customer",
  "party",
]);

export function MetaDataFlag({
  kind,
  raw,
}: {
  kind: "owner" | "counterparty";
  raw: string;
}) {
  const label = kind === "owner" ? "Unassigned" : raw;
  const tooltip =
    kind === "owner"
      ? `Owner missing - recorded as ${raw}`
      : `Counterparty name missing - currently shows "${raw}"`;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-md px-1 py-0 text-[11px] font-medium leading-[1.4]"
      style={{
        background: "color-mix(in oklab, var(--warning-soft) 18%, transparent)",
        color: "var(--warning-ink)",
      }}
    >
      <UserX aria-hidden className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
      {label}
    </span>
  );
}

export function OverflowCount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--text-primary)] tabular-nums">
      +{value}
    </span>
  );
}
