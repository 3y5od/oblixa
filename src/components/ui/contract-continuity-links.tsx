import Link from "next/link";

/** docs/refinement.md §16.3 — cross-object continuity when a row is tied to a contract. */
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
}) {
  const omit = new Set(props.omit ?? []);
  const id = props.contractId;
  const links: { page: ContinuityPage; href: string; label: string }[] = [
    { page: "contract", href: `/contracts/${id}`, label: "Contract" },
    { page: "work", href: "/work", label: "Work" },
    { page: "tasks", href: "/contracts/tasks", label: "Tasks" },
    { page: "obligations", href: "/contracts/obligations", label: "Obligations" },
    { page: "renewals", href: "/contracts/renewals", label: "Renewals" },
    { page: "exceptions", href: "/contracts/exceptions", label: "Exceptions" },
    { page: "evidence", href: "/contracts/evidence-studio", label: "Evidence" },
  ];
  const visible = links.filter((l) => !omit.has(l.page));
  if (visible.length === 0) return null;
  const shell = props.className ?? "mt-1 text-[11px] text-zinc-500";
  return (
    <p className={shell}>
      <span className="font-medium text-zinc-600">Open in:</span>{" "}
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
