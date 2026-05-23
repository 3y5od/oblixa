import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import type { AdminClient } from "@/lib/v6/service";

export type TenantAiProcessingGate =
  | { ok: true }
  | { ok: false; reason: "tenant_ai_processing_disabled" };

export async function requireTenantAiProcessingEnabled(
  admin: AdminClient,
  organizationId: string,
  env: Pick<NodeJS.ProcessEnv, "NODE_ENV"> = process.env
): Promise<TenantAiProcessingGate> {
  const settings = await getV6OrgSettingsJson(admin, organizationId);
  if (settings.ai_processing_enabled === true) return { ok: true };
  if (env.NODE_ENV === "production") return { ok: false, reason: "tenant_ai_processing_disabled" };
  if (settings.ai_processing_enabled === false) return { ok: false, reason: "tenant_ai_processing_disabled" };
  return { ok: true };
}
