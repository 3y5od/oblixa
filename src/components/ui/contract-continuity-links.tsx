import { Fragment } from "react";
import Link from "next/link";
import {
  resolveWorkflowDestination,
  type WorkflowDestinationKey,
  type WorkflowDestinationSurface,
} from "@/lib/product-surface/workflow-destinations";

/** product-surface policy §16.3 — cross-object continuity when a row is tied to a contract. */
export type ContinuityPage =
  | "contract"
  | "work"
  | "tasks"
  | "obligations"
  | "renewals"
  | "exceptions"
  | "evidence";

export function ContractContinuityLinks(props: {
  contractId: string;
  /** Omit links for the surface the user is already viewing. */
  omit?: ContinuityPage[];
  className?: string;
  surface?: WorkflowDestinationSurface;
  label?: string;
  /** Cap the number of destination chips rendered inline; the remainder collapse
   *  into a single "+N" overflow chip linking to the contract. Lets a dense list
   *  row show the first few related-work destinations without wrapping the whole
   *  set onto a messy second line. Omit to render every visible destination. */
  maxVisible?: number;
  /** "chips" (default) renders pill-shaped destination links; "inline" renders
   *  plain middot-separated text links with no pill border or fill, for dense
   *  ledger rows where the pills read as chip noise (§16 chip discipline). */
  variant?: "chips" | "inline";
}) {
  const omit = new Set(props.omit ?? []);
  const id = props.contractId;
  const surface = props.surface ?? { mode: "core" as const };
  const destinationPages: { page: ContinuityPage; key: WorkflowDestinationKey }[] = [
    { page: "work", key: "work" },
    { page: "tasks", key: "tasks" },
    { page: "obligations", key: "obligations" },
    { page: "renewals", key: "renewals" },
    { page: "exceptions", key: "exceptions" },
    { page: "evidence", key: "evidence" },
  ];
  const links: { page: ContinuityPage; href: string; label: string }[] = [
    { page: "contract", href: `/contracts/${id}`, label: "Contract" },
    ...destinationPages.flatMap(({ page, key }) => {
      const destination = resolveWorkflowDestination(surface, key);
      if (!destination?.visible) return [];
      return [{ page, href: destination.href, label: destination.copy.shortLabel ?? destination.copy.label }];
    }),
  ];
  const visible = links.filter((l) => !omit.has(l.page));
  if (visible.length === 0) return null;
  const label = props.label ?? "Related work";
  const shell = props.className ?? "mt-1 flex max-w-[18rem] flex-wrap items-center gap-x-1 gap-y-1 text-[12.5px] text-[var(--text-tertiary)]";
  const cap = props.maxVisible && props.maxVisible > 0 ? props.maxVisible : visible.length;
  const shown = visible.slice(0, cap);
  const overflow = visible.length - shown.length;
  if ((props.variant ?? "chips") === "inline") {
    const linkClass =
      "rounded-[3px] leading-none text-[var(--text-secondary)] underline-offset-2 transition-colors hover:text-[var(--accent-strong)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]";
    return (
      <div className={shell} aria-label={label}>
        <span className="pr-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]">
          {label}
        </span>
        {shown.map((l, index) => (
          <Fragment key={l.page}>
            {index > 0 ? <span aria-hidden className="text-[var(--text-tertiary)]">{"·"}</span> : null}
            <Link href={l.href} className={linkClass}>
              {l.label}
            </Link>
          </Fragment>
        ))}
        {overflow > 0 ? (
          <>
            <span aria-hidden className="text-[var(--text-tertiary)]">{"·"}</span>
            <Link
              href={`/contracts/${id}`}
              className={`tabular-nums ${linkClass} text-[var(--text-tertiary)]`}
              aria-label={`${overflow} more related ${overflow === 1 ? "destination" : "destinations"}`}
            >
              +{overflow} more
            </Link>
          </>
        ) : null}
      </div>
    );
  }
  const chipClass =
    "inline-flex min-h-6 items-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_66%,transparent)] px-2 text-[11px] font-medium leading-none text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]";
  return (
    <div className={shell} aria-label={label}>
      <span className="inline-flex min-h-6 items-center pr-1 text-[11px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
        {label}
      </span>
      {shown.map((l) => (
        <Link key={l.page} href={l.href} className={chipClass}>
          {l.label}
        </Link>
      ))}
      {overflow > 0 ? (
        <Link
          href={`/contracts/${id}`}
          className={`${chipClass} tabular-nums`}
          aria-label={`${overflow} more related ${overflow === 1 ? "destination" : "destinations"}`}
        >
          +{overflow}
        </Link>
      ) : null}
    </div>
  );
}
