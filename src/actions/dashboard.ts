"use server";

import { createAdminClient, createClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { hasRoleCapability } from "@/lib/access-control";

const VALID_KEYS = new Set(["now", "next", "risk"]);

export async function setDashboardQueuePinForm(formData: FormData) {
  const queueKey = String(formData.get("queueKey") ?? "").trim();
  const pinned = String(formData.get("pinned") ?? "") === "1";
  if (!VALID_KEYS.has(queueKey)) return { error: "Invalid queue key" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) return { error: "No membership found" };

  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("role_policy_json")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  const canManageSettings = hasRoleCapability({
    role: membership.role,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettings?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
  if (!canManageSettings) return { error: "Access denied" };

  const { data: existing } = await admin
    .from("organization_workflow_settings")
    .select("dashboard_pins_json")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  const pins = ((existing?.dashboard_pins_json as Record<string, unknown> | null) ?? {}) as Record<
    string,
    boolean
  >;
  pins[queueKey] = pinned;
  const { error } = await admin.from("organization_workflow_settings").upsert(
    {
      organization_id: membership.organization_id,
      dashboard_pins_json: pins,
      created_by: user.id,
    },
    { onConflict: "organization_id", ignoreDuplicates: false }
  );
  if (error) {
    console.error("[dashboard] upsert workflow settings:", error.message);
    return { error: "Failed to update dashboard pins" };
  }
  return { success: true };
}
