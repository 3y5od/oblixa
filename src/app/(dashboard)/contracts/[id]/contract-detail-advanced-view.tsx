import type { ContractDetailPageModel } from "./contract-detail-page-model";
import { ContractDetailAdvancedActivityNotes } from "./contract-detail-advanced-activity-notes";
import { ContractDetailAdvancedApprovalReminders } from "./contract-detail-advanced-approval-reminders";
import { ContractDetailAdvancedCasefileRecord } from "./contract-detail-advanced-casefile-record";
import { ContractDetailAdvancedHero } from "./contract-detail-advanced-hero";
import { ContractDetailAdvancedNotice } from "./contract-detail-advanced-notice";
import { ContractDetailAdvancedPrimarySections } from "./contract-detail-advanced-primary-sections";
import { ContractDetailAdvancedRenewalCard } from "./contract-detail-advanced-renewal-card";
import { ContractDetailAdvancedTabs } from "./contract-detail-advanced-tabs";
import { ContractDetailAdvancedWorkflowCard } from "./contract-detail-advanced-workflow-card";

export function ContractDetailAdvancedView({ model }: { model: ContractDetailPageModel }) {
  return (
    <div className="space-y-7 md:space-y-8">
      <ContractDetailAdvancedNotice model={model} />
      <ContractDetailAdvancedHero model={model} />
      <ContractDetailAdvancedTabs model={model} />
      <div className="grid grid-cols-1 gap-7 md:gap-8 lg:grid-cols-3">
        <div className="space-y-7 md:space-y-8 lg:col-span-2">
          <ContractDetailAdvancedPrimarySections model={model} />
        </div>
        <div className="space-y-7 md:space-y-8">
          <ContractDetailAdvancedWorkflowCard model={model} />
          <ContractDetailAdvancedRenewalCard model={model} />
          <ContractDetailAdvancedApprovalReminders model={model} />
          <ContractDetailAdvancedCasefileRecord model={model} />
          <ContractDetailAdvancedActivityNotes model={model} />
        </div>
      </div>
    </div>
  );
}
