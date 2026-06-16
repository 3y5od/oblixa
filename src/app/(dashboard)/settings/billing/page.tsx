import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import { getAuthContext } from "@/lib/supabase/server";
import { BillingAccessRevoked, BillingMembershipQueryFailed } from "./billing-access-state";
import { loadBillingPageData, type BillingSearchParams } from "./billing-page-model";
import { BillingPageView } from "./billing-page-view";

export const metadata = { title: SETTINGS_BILLING_STRINGS.title };
export const runtime = "nodejs";

export default async function BillingPage(props: {
  searchParams: Promise<BillingSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const state = await loadBillingPageData(ctx, searchParams);
  if (state.kind === "membership_query_failed") return <BillingMembershipQueryFailed />;
  if (state.kind === "access_revoked") return <BillingAccessRevoked />;
  return <BillingPageView data={state.data} />;
}
