import { cookies } from "next/headers";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { loadOperationsSettingsData } from "./load-operations-settings-data";
import { OperationsSettingsView } from "./operations-settings-view";

export const metadata = { title: "Workflow configuration" };

export default async function OperationsSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const cookieStore = await cookies();
  const newlyIssuedApiKey = cookieStore.get("oblixa_new_api_key_token")?.value ?? null;

  const data = await loadOperationsSettingsData(ctx.admin, ctx.orgId);

  return <OperationsSettingsView newlyIssuedApiKey={newlyIssuedApiKey} data={data} />;
}
