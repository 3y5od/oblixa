import type { ContractDetailPageModel } from "./contract-detail-page-model";
import { ContractDetailAdvancedHeroHeader } from "./contract-detail-advanced-hero-header";
import { ContractDetailAdvancedImmediateActions } from "./contract-detail-advanced-immediate-actions";
import { ContractDetailAdvancedTrust } from "./contract-detail-advanced-trust";

export function ContractDetailAdvancedHero({ model }: { model: ContractDetailPageModel }) {
  return (
    <div className="ui-card-hero overflow-hidden">
      <div className="border-b border-[var(--border-subtle)]/90 bg-[radial-gradient(circle_at_top_right,var(--canvas-glow),transparent_24%),linear-gradient(180deg,var(--surface-tint),var(--surface-raised))] px-5 py-6 md:px-10 md:py-8">
        <ContractDetailAdvancedHeroHeader model={model} />
        <ContractDetailAdvancedTrust model={model} />
        <ContractDetailAdvancedImmediateActions model={model} />
      </div>
    </div>
  );
}
