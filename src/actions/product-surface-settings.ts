"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/supabase/server";
import {
  getV6OrgSettingsJson,
  mergeV6OrgSettingsJson,
  type V6OrgSettingsMergePatch,
} from "@/lib/v6/org-settings";
import type { WorkspaceRole } from "@/lib/navigation";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  ProductSearchScope,
  UtilityModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";
import { applyWorkspaceProductTransitionSideEffects } from "@/lib/product-surface/workspace-transition";
import { isValidDefaultLandingPath } from "@/lib/product-surface/landing-eligibility";
import { parseOnboardingCalibration } from "@/lib/onboarding/calibration-types";
import { requireServerActionEligibility } from "@/lib/product-surface/server-action-guard";

const ADVANCED_NAV_ROLE_OPTIONS: WorkspaceRole[] = [
  "admin",
  "editor",
  "viewer",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
  "manager",
];

function parseAdvancedNavRolesForPatch(
  formData: FormData
): WorkspaceRole[] | null | undefined {
  if (formData.get("customize_advanced_nav_roles") !== "on") return null;
  const out: WorkspaceRole[] = [];
  for (const r of ADVANCED_NAV_ROLE_OPTIONS) {
    if (formData.get(`adv_nav_${r}`) === "on") out.push(r);
  }
  return out;
}

/** `null` = revert to defaults; `undefined` = do not change stored value (form did not apply this section). */
function parseAssuranceNavRolesForPatch(
  formData: FormData,
  workspaceMode: WorkspaceProductMode
): WorkspaceRole[] | null | undefined {
  if (workspaceMode !== "assurance") return undefined;
  if (formData.get("customize_assurance_nav_roles") !== "on") return null;
  const out: WorkspaceRole[] = [];
  for (const r of ADVANCED_NAV_ROLE_OPTIONS) {
    if (formData.get(`asm_nav_${r}`) === "on") out.push(r);
  }
  return out;
}

function parseMode(raw: FormDataEntryValue | null): WorkspaceProductMode | undefined {
  const s = String(raw ?? "").trim();
  if (s === "core" || s === "advanced" || s === "assurance") return s;
  return undefined;
}

function parseHiddenModules(formData: FormData): AdvancedNavModuleKey[] {
  const keys: AdvancedNavModuleKey[] = [
    "decisions",
    "campaigns",
    "programs",
    "relationships",
    "analytics",
    "maintenance",
    "collaboration",
    "compare_views",
  ];
  const out: AdvancedNavModuleKey[] = [];
  for (const k of keys) {
    if (formData.get(`hide_${k}`) === "on") out.push(k);
  }
  return out;
}

function parseHiddenAssuranceModules(formData: FormData): AssuranceNavModuleKey[] {
  const keys: AssuranceNavModuleKey[] = [
    "findings",
    "control_policies",
    "scorecards",
    "playbooks",
    "autopilot",
    "review_boards",
    "segments",
    "program_evolution",
    "health_graph",
    "outcome_intelligence",
  ];
  const out: AssuranceNavModuleKey[] = [];
  for (const k of keys) {
    if (formData.get(`hide_assurance_${k}`) === "on") out.push(k);
  }
  return out;
}

function parseHiddenUtilityModules(formData: FormData): UtilityModuleKey[] {
  const keys: UtilityModuleKey[] = [
    "intake",
    "data_quality",
    "review_cadence",
    "watchlists",
    "execution_graph",
    "approval_workload",
    "approval_sla_simulator",
    "more_tools",
  ];
  const out: UtilityModuleKey[] = [];
  for (const k of keys) {
    if (formData.get(`hide_utility_${k}`) === "on") out.push(k);
  }
  return out;
}

function parseSearchScope(formData: FormData): ProductSearchScope {
  return formData.get("search_scope") === "core_only" ? "core_only" : "match_mode";
}

const HOME_SECTION_KEYS = [
  "control_room_strip",
  "telemetry_compact",
  "v6_assurance_snapshot",
  "outcome_intelligence",
  "assurance_signals",
] as const;

function parseHiddenHomeSections(formData: FormData): string[] {
  return HOME_SECTION_KEYS.filter((k) => formData.get(`hide_home_${k}`) === "on").map((k) => k);
}

const EMAIL_MUTE_KEYS = ["reminder_due", "saved_view_summary", "automation_rule"] as const;

export async function updateWorkspaceProductSurfaceForm(formData: FormData): Promise<{ error: string } | { success: true }> {
  const eligibility = await requireServerActionEligibility({
    actionId: "product-surface-settings:updateWorkspaceProductSurfaceForm",
    featureFamily: "settings",
  });
  if (!eligibility.ok) return { error: "Not eligible" };

  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { error: "Unauthorized" };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);

  const mode = parseMode(formData.get("workspace_mode")) ?? "core";
  const defaultLandingRaw = String(formData.get("default_landing_path") ?? "").trim();
  const assurance_nav_admin_testing = formData.get("assurance_nav_admin_testing") === "on";
  const autopilot_allow_execution = formData.get("autopilot_allow_execution") === "on";

  const assuranceNavRolesPatch = parseAssuranceNavRolesForPatch(formData, mode);

  const patch: V6OrgSettingsMergePatch = {
    workspace_mode: mode,
    advanced_modules_hidden: parseHiddenModules(formData),
    assurance_modules_hidden: parseHiddenAssuranceModules(formData),
    utility_modules_hidden: parseHiddenUtilityModules(formData),
    home_hidden_sections: parseHiddenHomeSections(formData),
    assurance_nav_admin_testing,
    autopilot_allow_execution,
    search_scope: parseSearchScope(formData),
    advanced_nav_roles: parseAdvancedNavRolesForPatch(formData),
    ...(assuranceNavRolesPatch !== undefined ? { assurance_nav_roles: assuranceNavRolesPatch } : {}),
  };
  if (defaultLandingRaw === "") {
    patch.default_landing_path = "";
  } else if (defaultLandingRaw.startsWith("/")) {
    if (!isValidDefaultLandingPath(defaultLandingRaw, mode)) {
      return { error: "Invalid landing path" };
    }
    patch.default_landing_path = defaultLandingRaw;
  }

  const { data: merged, error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, patch);
  if (error) {
    console.error("[product-surface-settings]", error.message);
    return { error: error.message };
  }

  const prevMode = parseWorkspaceMode(prevV6);
  const nextModeFinal = parseWorkspaceMode(merged ?? prevV6);
  const transitionSideEffects = await applyWorkspaceProductTransitionSideEffects({
    admin: ctx.admin,
    orgId: ctx.orgId,
    userId: ctx.user.id,
    prevMode,
    nextMode: nextModeFinal,
  });
  const hadCalibrationApplied = Boolean(
    parseOnboardingCalibration(prevV6.onboarding_calibration)?.last_applied
  );
  if (hadCalibrationApplied && prevMode !== nextModeFinal) {
    await ctx.admin.from("audit_events").insert({
      organization_id: ctx.orgId,
      contract_id: null,
      user_id: ctx.user.id,
      action: "onboarding.post_calibration_mode_changed",
      details: {
        prev_workspace_mode: prevMode,
        next_workspace_mode: nextModeFinal,
      },
    });
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    contract_id: null,
    user_id: ctx.user.id,
    action: "workspace.product_surface_updated",
    details: {
      source: "product_settings",
      prev_workspace_mode: prevMode,
      next_workspace_mode: nextModeFinal,
      prev_default_landing_path: prevV6.default_landing_path ?? null,
      next_default_landing_path: merged?.default_landing_path ?? null,
      prev_advanced_modules_hidden: prevV6.advanced_modules_hidden ?? [],
      next_advanced_modules_hidden: merged?.advanced_modules_hidden ?? [],
      prev_assurance_modules_hidden: prevV6.assurance_modules_hidden ?? [],
      next_assurance_modules_hidden: merged?.assurance_modules_hidden ?? [],
      prev_utility_modules_hidden: prevV6.utility_modules_hidden ?? [],
      next_utility_modules_hidden: merged?.utility_modules_hidden ?? [],
      prev_advanced_nav_roles: prevV6.advanced_nav_roles ?? null,
      next_advanced_nav_roles: merged?.advanced_nav_roles ?? null,
      prev_assurance_nav_roles: prevV6.assurance_nav_roles ?? null,
      next_assurance_nav_roles: merged?.assurance_nav_roles ?? null,
      prev_assurance_nav_admin_testing: prevV6.assurance_nav_admin_testing === true,
      next_assurance_nav_admin_testing: merged?.assurance_nav_admin_testing === true,
      prev_home_hidden_sections: prevV6.home_hidden_sections ?? [],
      next_home_hidden_sections: merged?.home_hidden_sections ?? [],
      prev_search_scope: prevV6.search_scope ?? "match_mode",
      next_search_scope: merged?.search_scope ?? "match_mode",
      prev_autopilot_allow_execution: prevV6.autopilot_allow_execution === true,
      next_autopilot_allow_execution: merged?.autopilot_allow_execution === true,
      auto_blocked_notification_types: transitionSideEffects.autoBlockedNotificationTypes,
      suppressed_report_pack_subscription_count: transitionSideEffects.suppressedSubscriptionCount,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/product");
  revalidatePath("/dashboard");
  revalidatePath("/more");
  revalidatePath("/onboarding/calibration");
  return { success: true as const };
}

export async function resetWorkspaceProductSurfaceDefaultsForm(): Promise<{ error: string } | { success: true }> {
  const eligibility = await requireServerActionEligibility({
    actionId: "product-surface-settings:resetWorkspaceProductSurfaceDefaultsForm",
    featureFamily: "settings",
  });
  if (!eligibility.ok) return { error: "Not eligible" };

  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { error: "Unauthorized" };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevMode = parseWorkspaceMode(prevV6);
  const patch: V6OrgSettingsMergePatch = {
    workspace_mode: "core",
    default_landing_path: "",
    search_scope: "match_mode",
    advanced_modules_hidden: [
      "decisions",
      "campaigns",
      "programs",
      "relationships",
      "analytics",
      "maintenance",
      "collaboration",
      "compare_views",
    ],
    assurance_modules_hidden: [
      "findings",
      "control_policies",
      "scorecards",
      "playbooks",
      "autopilot",
      "review_boards",
      "segments",
      "program_evolution",
      "health_graph",
      "outcome_intelligence",
    ],
    utility_modules_hidden: [],
    home_hidden_sections: [],
    advanced_nav_roles: null,
    assurance_nav_roles: null,
    assurance_nav_admin_testing: false,
    autopilot_allow_execution: false,
  };
  const { data: merged, error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, patch);
  if (error) return { error: error.message };
  await applyWorkspaceProductTransitionSideEffects({
    admin: ctx.admin,
    orgId: ctx.orgId,
    userId: ctx.user.id,
    prevMode,
    nextMode: "core",
  });
  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    contract_id: null,
    user_id: ctx.user.id,
    action: "workspace.product_surface_reset_defaults",
    details: {
      prev_workspace_mode: prevMode,
      next_workspace_mode: parseWorkspaceMode(merged ?? prevV6),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/product");
  revalidatePath("/dashboard");
  revalidatePath("/more");
  revalidatePath("/onboarding/calibration");
  return { success: true as const };
}

/** Merge email notification `blocked_types` for known keys (docs/refinement.md §18.1 / §21). */
export async function updateProductEmailNotificationCategoriesForm(formData: FormData): Promise<{ error: string } | { success: true }> {
  const eligibility = await requireServerActionEligibility({
    actionId: "product-surface-settings:updateProductEmailNotificationCategoriesForm",
    featureFamily: "settings",
  });
  if (!eligibility.ok) return { error: "Not eligible" };

  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { error: "Unauthorized" };

  const muted = EMAIL_MUTE_KEYS.filter((k) => formData.get(`mute_email_${k}`) === "on");
  const { data: row } = await ctx.admin
    .from("organization_workflow_settings")
    .select("notification_policy_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  const prev = (row?.notification_policy_json ?? {}) as Record<string, unknown>;
  const prevEmail = (prev.email ?? {}) as Record<string, unknown>;
  const prevBlocked = Array.isArray(prevEmail.blocked_types)
    ? (prevEmail.blocked_types as unknown[]).map((v) => String(v))
    : [];
  const prevOther = prevBlocked.filter((t) => !EMAIL_MUTE_KEYS.includes(t as (typeof EMAIL_MUTE_KEYS)[number]));
  const nextBlocked = [...new Set([...prevOther, ...muted])];

  const nextPolicy = {
    ...prev,
    email: {
      ...prevEmail,
      blocked_types: nextBlocked,
    },
  };

  const { error } = await ctx.admin
    .from("organization_workflow_settings")
    .update({ notification_policy_json: nextPolicy })
    .eq("organization_id", ctx.orgId);

  if (error) {
    console.error("[product-surface-settings] notification categories", error.message);
    return { error: error.message };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    contract_id: null,
    user_id: ctx.user.id,
    action: "workspace.notification_policy_updated",
    details: {
      channel: "email",
      prev_blocked_types: prevBlocked,
      next_blocked_types: nextBlocked,
      affected_known_categories: muted,
    },
  });

  revalidatePath("/settings/product");
  revalidatePath("/settings/operations");
  return { success: true as const };
}
