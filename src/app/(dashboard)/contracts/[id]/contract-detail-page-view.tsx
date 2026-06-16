import type { ContractDetailPageModel } from "./contract-detail-page-model";
import { ContractDetailAdvancedView } from "./contract-detail-advanced-view";
import { ContractDetailCoreView } from "./contract-detail-core-view";

export function ContractDetailPageView({ model }: { model: ContractDetailPageModel }) {
  return model.isCoreContractDetail ? (
    <ContractDetailCoreView model={model} />
  ) : (
    <ContractDetailAdvancedView model={model} />
  );
}
