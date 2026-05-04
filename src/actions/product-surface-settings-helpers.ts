import { getAuthContext } from "@/lib/supabase/server";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";
import { reportSubscriptionIdsIneligibleForWorkspaceMode } from "@/lib/product-surface/workspace-transition";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
  ALL_UTILITY_MODULE_KEYS,
  WORKSPACE_HOME_SECTION_KEYS,
  WORKSPACE_NAV_ROLE_ORDER,
} from "@/lib/product-surface/workspace-module-keys";
import { executeV10IdempotentMutation } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { buildV10MutationResponse } from "@/lib/v10-mutation-envelope";
import type { ProductSearchScope, WorkspaceProductMode } from "@/lib/product-surface/types";
import type { V10Plan } from "@/lib/v10-release-contract";

const WORKSPACE_HOME_HIDE_KEYS = [
  "control_room_strip",
  "telemetry_compact",
  "v6_assurance_snapshot",
  "outcome_intelligence",
  "assurance_signals",
] as const satisfies typeof WORKSPACE_HOME_SECTION_KEYS;

export const EMAIL_NOTIFICATION_POLICY_TYPES = NOTIFICATION_TAXONOMY.map((entry) => entry.notificationType);
export type ProductSurfaceActionContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;

export function parseAdvancedNavRolesForPatch(formData: FormData) {
  if (formData.get("customize_advanced_nav_roles") !== "on") return null;
  const out: Array<(typeof WORKSPACE_NAV_ROLE_ORDER)[number]> = [];
  for (const r of WORKSPACE_NAV_ROLE_ORDER) if (formData.get(`adv_nav_${r}`) === "on") out.push(r);
  return out;
}

export function parseAssuranceNavRolesForPatch(formData: FormData, workspaceMode: WorkspaceProductMode) {
  if (workspaceMode !== "assurance") return undefined;
  if (formData.get("customize_assurance_nav_roles") !== "on") return null;
  const out: Array<(typeof WORKSPACE_NAV_ROLE_ORDER)[number]> = [];
  for (const r of WORKSPACE_NAV_ROLE_ORDER) if (formData.get(`asm_nav_${r}`) === "on") out.push(r);
  return out;
}

export function parseMode(raw: FormDataEntryValue | null): WorkspaceProductMode | undefined {
  const s = String(raw ?? "").trim();
  if (s === "core" || s === "advanced" || s === "assurance") return s;
  return undefined;
}

export function parseHiddenModules(formData: FormData) {
  return ALL_ADVANCED_NAV_MODULE_KEYS.filter((k) => formData.get(`hide_${k}`) === "on");
}

export function parseHiddenAssuranceModules(formData: FormData) {
  return ALL_ASSURANCE_NAV_MODULE_KEYS.filter((k) => formData.get(`hide_assurance_${k}`) === "on");
}

export function parseHiddenUtilityModules(formData: FormData) {
  return ALL_UTILITY_MODULE_KEYS.filter((k) => formData.get(`hide_utility_${k}`) === "on");
}

export function parseSearchScope(formData: FormData): ProductSearchScope {
  return formData.get("search_scope") === "core_only" ? "core_only" : "match_mode";
}

export function parseHiddenHomeSections(formData: FormData): string[] {
  return WORKSPACE_HOME_HIDE_KEYS.filter((k) => formData.get(`hide_home_${k}`) === "on").map((k) => k);
}

function isV10Plan(value: unknown): value is V10Plan {
  return ["trial", "core", "advanced", "assurance", "enterprise"].includes(String(value ?? ""));
}

export function resolveExplicitWorkspacePlan(v6: unknown): V10Plan | null {
  const settings = v6 && typeof v6 === "object" ? (v6 as Record<string, unknown>) : {};
  const rawPlan = settings.workspace_plan ?? settings.billing_plan ?? settings.subscription_plan ?? settings.plan;
  return isV10Plan(rawPlan) ? rawPlan : null;
}

export function minimumPlanForWorkspaceMode(mode: WorkspaceProductMode): V10Plan {
  if (mode === "advanced") return "advanced";
  if (mode === "assurance") return "assurance";
  return "trial";
}

export function workspaceModeRank(mode: WorkspaceProductMode): number {
  if (mode === "assurance") return 3;
  if (mode === "advanced") return 2;
  return 1;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export async function countScheduledReportSubscriptionsSuppressedByModeChange(
  admin: ProductSurfaceActionContext["admin"],
  orgId: string,
  nextMode: WorkspaceProductMode
): Promise<number> {
  const { data: activeSubs } = await admin
    .from("report_pack_subscriptions")
    .select("id, report_pack_id")
    .eq("organization_id", orgId)
    .eq("active", true);
  const packIds = [...new Set((activeSubs ?? []).map((row) => String(row.report_pack_id)))].filter(Boolean);
  if (packIds.length === 0) return 0;

  const { data: packs } = await admin.from("report_packs").select("id, report_type").eq("organization_id", orgId).in("id", packIds);
  return reportSubscriptionIdsIneligibleForWorkspaceMode({
    mode: nextMode,
    subscriptions: (activeSubs ?? []).map((sub) => ({ id: String(sub.id), report_pack_id: String(sub.report_pack_id) })),
    packs: (packs ?? []).map((pack) => ({ id: String(pack.id), report_type: String(pack.report_type ?? "") })),
  }).length;
}

export async function refreshV10SettingsReadModels(admin: ProductSurfaceActionContext["admin"], orgId: string) {
  try {
    await refreshV10ReadModelsForOrganization(admin, orgId, {
      refreshScope: "one_model",
      reason: "product_surface_settings_mutation",
      modelKeys: ["work_items", "notification_deliveries", "audit_events", "command_search_index", "advanced_assurance_linked_records"],
    });
  } catch (error) {
    console.error("[product-surface-settings] V10 read-model refresh failed:", error);
  }
}

export async function reserveV10SettingsMutation(
  ctx: ProductSurfaceActionContext,
  input: { mutationName: string; targetId: string; currentVersion: string; payload: Record<string, unknown> }
): Promise<{ error: string } | null> {
  const { response } = await executeV10IdempotentMutation(
    ctx.admin,
    {
      organizationId: ctx.orgId,
      actorUserId: ctx.user.id,
      mutationName: input.mutationName,
      targetType: "setting",
      targetId: input.targetId,
      idempotencyKey: `v10-server-action:${crypto.randomUUID()}`,
      expectedVersion: input.currentVersion,
      currentVersion: input.currentVersion,
      payload: input.payload,
    },
    async () =>
      buildV10MutationResponse({
        outcome: "success",
        message: "Settings mutation reserved.",
        changedObjectType: "setting",
        changedObjectId: input.targetId,
        nextDestinationHref: "/settings/health",
      })
  );
  return response.outcome === "success" ? null : { error: response.user_visible_message };
}