import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { loadContractDetailPageModel, type ContractDetailSearchParams } from "./contract-detail-page-model";
import { ContractDetailPageView } from "./contract-detail-page-view";

export const metadata = { title: "Contract" };

export default async function ContractDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ContractDetailSearchParams>;
}) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for contract details"
        message="Contract detail, review continuity, and evidence state are only available inside a workspace. Refresh this page, then ask a workspace admin to restore access if this record stays unavailable."
      />
    );
  }

  const model = await loadContractDetailPageModel({ ctx, id, searchParams });
  return <ContractDetailPageView model={model} />;
}
