import type { ContractDetailPageModel } from "./contract-detail-page-model";
import { ContractDetailCoreHeader } from "./contract-detail-core-header";
import { ContractDetailCoreOperationalSections } from "./contract-detail-core-operational-sections";
import { ContractDetailCoreReviewSections } from "./contract-detail-core-review-sections";
import { ContractDetailCoreSideRail } from "./contract-detail-core-side-rail";

export function ContractDetailCoreView({ model }: { model: ContractDetailPageModel }) {
  return (
    <div className="ui-page-stack mx-auto max-w-7xl" data-contract-detail-core>
      <ContractDetailCoreHeader model={model} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <main className="space-y-6">
          <ContractDetailCoreReviewSections model={model} />
          <ContractDetailCoreOperationalSections model={model} />
        </main>
        <ContractDetailCoreSideRail model={model} />
      </div>
    </div>
  );
}
