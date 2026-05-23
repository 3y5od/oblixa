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
  return (
    <div className={shell} aria-label={label}>
      <span className="inline-flex min-h-6 items-center pr-1 text-[11px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
        {label}
      </span>
      {visible.map((l) => (
        <Link
          key={l.page}
          href={l.href}
          className="inline-flex min-h-6 items-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_66%,transparent)] px-2 text-[11px] font-medium leading-none text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
