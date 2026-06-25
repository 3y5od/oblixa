import { DataSurfaceCard, DataSurfaceShell } from "@/components/ui/data-surface-shell";
import { ContractsEmptyStartSection } from "./contracts-empty-start-section";
import { ContractsFiltersSection } from "./contracts-filters-section";
import { ContractsPageHeader } from "./contracts-page-header";
import { ContractsShortcutStrip } from "./contracts-shortcut-strip";
import { ContractsTableSection } from "./contracts-table-section";
import type { ContractsPageModel } from "./contracts-page-model";

export function ContractsPageView({ model }: { model: ContractsPageModel }) {
  return (
    <DataSurfaceShell
      width="wide"
      header={
        <ContractsPageHeader
          orgId={model.orgId}
          canEdit={model.canEdit}
          workspaceContractTotal={model.workspaceContractTotal}
          latestExportSummary={model.latestExportSummary}
        />
      }
    >
      {model.workspaceContractTotal === 0 ? <ContractsEmptyStartSection canEdit={model.canEdit} /> : null}
      <DataSurfaceCard>
        <ContractsFiltersSection model={model} />
        <ContractsShortcutStrip model={model} />
        <ContractsTableSection model={model} />
      </DataSurfaceCard>
    </DataSurfaceShell>
  );
}
