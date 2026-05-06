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
  const shell = props.className ?? "mt-1 text-[11px] text-[var(--text-tertiary)]";
  return (
    <p className={shell}>
      <span className="font-medium text-[var(--text-secondary)]">Continue in:</span>{" "}
      {visible.map((l, i) => (
        <span key={l.page}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          <Link href={l.href} className="ui-link">
            {l.label}
          </Link>
        </span>
      ))}
    </p>
  );
}
