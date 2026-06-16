import { EmptyStateTelemetryLink } from "@/components/ui/empty-state-telemetry-link";
import { RecoverableState } from "@/components/ui/recoverable-state";
import type { ContractTableEmptyStateConfig } from "./contract-table-types";

export function ContractTableEmptyState({
  emptyState,
}: {
  emptyState?: ContractTableEmptyStateConfig;
}) {
  if (emptyState) {
    return (
      <RecoverableState
        state="empty"
        title={emptyState.title}
        reason={emptyState.copy}
        accessibleName="Filtered contracts empty state"
        surface="contracts"
        section="contract_table"
        sourceObject="contract"
        nextActionLabel={emptyState.actionLabel}
        nextAction={
          <EmptyStateTelemetryLink
            href={emptyState.actionHref}
            className="ui-btn-primary px-6"
            surface="contracts"
            section="contract_table"
            sourceObject="contract"
            actionLabel={emptyState.actionLabel}
          >
            {emptyState.actionLabel}
          </EmptyStateTelemetryLink>
        }
      />
    );
  }

  return (
    <RecoverableState
      state="empty"
      title="No contracts yet"
      reason="Upload an agreement so Oblixa can suggest dates and build your operational record."
      accessibleName="Contracts empty state"
      surface="contracts"
      section="contract_table"
      sourceObject="contract"
      nextActionLabel="Upload contract"
      nextAction={
        <EmptyStateTelemetryLink
          href="/contracts/new"
          className="ui-btn-primary px-6"
          surface="contracts"
          section="contract_table"
          sourceObject="contract"
          actionLabel="Upload contract"
        >
          Upload contract
        </EmptyStateTelemetryLink>
      }
    />
  );
}
