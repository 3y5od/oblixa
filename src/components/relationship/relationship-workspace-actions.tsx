import Link from "next/link";

type RelationshipAction = {
  label: string;
  href: string;
  description: string;
  disabled?: boolean;
};

function queryHref(path: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function buildRelationshipWorkspaceActions(input: {
  relationshipKind: "account" | "counterparty";
  relationshipKey: string;
  sourceContractId?: string | null;
}): RelationshipAction[] {
  const scopeParam = input.relationshipKind === "account" ? "account_key" : "counterparty_key";
  const sourceContractHref = input.sourceContractId ? `/contracts/${input.sourceContractId}` : null;
  const filteredContractsHref = queryHref("/contracts", {
    q: input.relationshipKey,
    [scopeParam]: input.relationshipKey,
  });
  return [
    {
      label: "Review filtered contracts",
      href: filteredContractsHref,
      description: "Review the contracts that make up this relationship workspace.",
    },
    {
      label: "Review related work",
      href: queryHref("/work", { lens: "assigned", source: input.relationshipKind, key: input.relationshipKey }),
      description: "Continue tasks, approvals, obligations, exceptions, and evidence work tied to this relationship.",
    },
    {
      label: "Review renewal horizon",
      href: queryHref("/contracts/renewals", { horizon: "renewal_90", [scopeParam]: input.relationshipKey }),
      description: "Inspect notice and renewal pressure across the relationship.",
    },
    {
      label: "Request evidence",
      href: sourceContractHref ? `${sourceContractHref}?tab=overview#contract-evidence` : filteredContractsHref,
      description: sourceContractHref
        ? "Start or review evidence requests from the lead contract record."
        : "Select a contract first, then request evidence from its record.",
      disabled: !sourceContractHref,
    },
    {
      label: "Create task",
      href: sourceContractHref ? `${sourceContractHref}#contract-tasks` : filteredContractsHref,
      description: sourceContractHref
        ? "Create follow-up work from the lead contract record."
        : "Select a contract first, then create relationship follow-up work.",
      disabled: !sourceContractHref,
    },
    {
      label: "Create exception",
      href: sourceContractHref ? `${sourceContractHref}#exceptions` : "/contracts/exceptions?status=open",
      description: sourceContractHref
        ? "Capture relationship risk on the lead contract record."
        : "Use the exceptions ledger to create or triage relationship risk.",
      disabled: !sourceContractHref,
    },
    {
      label: "Review timeline",
      href: "#relationship-timeline",
      description: "Review the relationship activity trail.",
    },
  ];
}

export function RelationshipWorkspaceActions(props: {
  relationshipKind: "account" | "counterparty";
  relationshipKey: string;
  sourceContractId?: string | null;
}) {
  const actions = buildRelationshipWorkspaceActions(props);
  return (
    <section className="ui-page-shell p-5" aria-labelledby="relationship-actions-title">
      <p className="ui-eyebrow">Actions</p>
      <h2 id="relationship-actions-title" className="ui-section-title mt-1 text-base">
        Relationship next steps
      </h2>
      <p className="ui-section-lead mt-2">
        Every relationship workspace links back to the V10 work, search, renewal, evidence, task, exception, and timeline flows.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            aria-disabled={action.disabled ? "true" : undefined}
            className="ui-operational-card block p-4 hover:border-[var(--border-strong)]"
          >
            <span className="font-medium text-[var(--text-primary)]">{action.label}</span>
            <span className="mt-1 block text-xs text-[var(--text-secondary)]">{action.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
