import { redirect } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { ContractsPageView } from "./contracts-page-view";
import { loadContractsPageModel, type ContractsSearchParams } from "./contracts-page-model";

export const metadata = { title: "Contracts" };

export default async function ContractsPage(props: {
  searchParams: Promise<ContractsSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const result = await loadContractsPageModel(ctx, searchParams);
  if ("redirectHref" in result) {
    redirect(result.redirectHref);
  }

  return <ContractsPageView model={result.model} />;
}
