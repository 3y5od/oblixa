import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailCoreSourceDocuments({ model }: { model: ContractDetailPageModel }) {
  return (
    <D.ContractSourceDocuments
      title="Source documents"
      contractId={model.contract.id}
      files={model.contract.contract_files ?? []}
      filesCount={model.filesCount}
      hasSourceFiles={model.hasSourceFiles}
      canEdit={model.canEdit}
    />
  );
}
