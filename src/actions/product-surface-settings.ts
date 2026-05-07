"use server";

import { revalidatePath } from "next/cache";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { getAuthContext } from "@/lib/supabase/server";
import {
  getV6OrgSettingsJson,
  mergeV6OrgSettingsJson,
  type V6OrgSettingsMergePatch,
} from "@/lib/v6/org-settings";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import {
  applyWorkspaceProductTransitionSideEffects,
} from "@/lib/product-surface/workspace-transition";
import { isValidDefaultLandingPath } from "@/lib/product-surface/landing-eligibility";
import { parseOnboardingCalibration } from "@/lib/onboarding/calibration-types";
import { requireServerActionEligibility } from "@/lib/product-surface/server-action-guard";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
} from "@/lib/product-surface/workspace-module-keys";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import {
  countScheduledReportSubscriptionsSuppressedByModeChange,
  EMAIL_NOTIFICATION_POLICY_TYPES,
  parseAdvancedNavRolesForPatch,
  parseAssuranceNavRolesForPatch,
  parseHiddenAssuranceModules,
  parseHiddenHomeSections,
  parseHiddenModules,
  parseHiddenUtilityModules,
  parseMode,
  parseSearchScope,
  pluralize,
  refreshV10SettingsReadModels,
  reserveV10SettingsMutation,
  workspaceModeRank,
} from "./product-surface-settings-helpers";

type ProductSurfaceActionResult = { error: string } | { success: true };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

async function recoverProductSurfaceAction(
  scope: string,
  run: () => Promise<ProductSurfaceActionResult>
): Promise<ProductSurfaceActionResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`[product-surface-settings] ${scope} failed`, error);
    return { error: describeRecoverableMutationError(errorMessage(error)) };
  }
}

async function safeInsertLegacyAuditEvent(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  row: Record<string, unknown>
): Promise<{ error: string } | null> {
  try {
    const { error } = await ctx.admin.from("audit_events").insert(row);
    if (!error) return null;
    console.error("[product-surface-settings] audit_events insert failed:", error.message);
  } catch (error) {
    console.error("[product-surface-settings] audit_events insert threw:", error);
  }
  return null;
}

async function safeApplyWorkspaceProductTransitionSideEffects(input: Parameters<typeof applyWorkspaceProductTransitionSideEffects>[0]) {
  try {
    return await applyWorkspaceProductTransitionSideEffects(input);
  } catch (error) {
    console.error("[product-surface-settings] transition side effects failed:", error);
    return { autoBlockedNotificationTypes: [], suppressedSubscriptionCount: 0 };
  }
}

export async function updateWorkspaceProductSurfaceForm(formData: FormData): Promise<ProductSurfaceActionResult> {
  return recoverProductSurfaceAction("updateWorkspaceProductSurfaceForm", () =>
    updateWorkspaceProductSurfaceFormUnsafe(formData)
  );
}

async function updateWorkspaceProductSurfaceFormUnsafe(formData: FormData): Promise<ProductSurfaceActionResult> {
  const eligibility = await requireServerActionEligibility({
    actionId: "product-surface-settings:updateWorkspaceProductSurfaceForm",
    featureFamily: "settings",
  });
  if (!eligibility.ok) return { error: "This workspace cannot change product experience settings right now." };

  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { error: "Only workspace admins can change product experience settings." };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevVersion = JSON.stringify(prevV6);
  const prevMode = parseWorkspaceMode(prevV6);

  const mode = parseMode(formData.get("workspace_mode")) ?? "core";
  const defaultLandingRaw = String(formData.get("default_landing_path") ?? "").trim();
  const assurance_nav_admin_testing = formData.get("assurance_nav_admin_testing") === "on";
  const autopilot_allow_execution = formData.get("autopilot_allow_execution") === "on";
  const confirmScheduledReportDowngrade = formData.get("confirm_scheduled_report_downgrade") === "on";

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
      return { error: "That default landing path is not available in the selected workspace mode." };
    }
    patch.default_landing_path = defaultLandingRaw;
  }

  if (workspaceModeRank(mode) < workspaceModeRank(prevMode)) {
    const suppressedSubscriptionCount = await countScheduledReportSubscriptionsSuppressedByModeChange(
      ctx.admin,
      ctx.orgId,
      mode
    );
    if (suppressedSubscriptionCount > 0 && !confirmScheduledReportDowngrade) {
      return {
        error: `This mode change would suppress ${suppressedSubscriptionCount} active scheduled report ${pluralize(
          suppressedSubscriptionCount,
          "subscription"
        )}. Confirm scheduled report suppression and save again.`,
      };
    }
  }

  const v10Reservation = await reserveV10SettingsMutation(ctx, {
    mutationName: "update_workspace_mode",
    targetId: "workspace_product_surface",
    currentVersion: prevVersion,
    payload: {
      mode,
      default_landing_path_state: defaultLandingRaw ? "provided" : "default",
      advanced_hidden_count: patch.advanced_modules_hidden?.length ?? 0,
      assurance_hidden_count: patch.assurance_modules_hidden?.length ?? 0,
      utility_hidden_count: patch.utility_modules_hidden?.length ?? 0,
    },
  });
  if (v10Reservation) return v10Reservation;
  const v10ModuleReservation = await reserveV10SettingsMutation(ctx, {
    mutationName: "update_module_visibility",
    targetId: "workspace_product_surface_modules",
    currentVersion: prevVersion,
    payload: {
      advanced_hidden_count: patch.advanced_modules_hidden?.length ?? 0,
      assurance_hidden_count: patch.assurance_modules_hidden?.length ?? 0,
      utility_hidden_count: patch.utility_modules_hidden?.length ?? 0,
    },
  });
  if (v10ModuleReservation) return v10ModuleReservation;

  const { data: merged, error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, patch);
  if (error) {
    console.error("[product-surface-settings]", error.message);
    return { error: error.message };
  }

  const nextModeFinal = parseWorkspaceMode(merged ?? prevV6);
  const transitionSideEffects = await safeApplyWorkspaceProductTransitionSideEffects({
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
    const calibrationAuditError = await safeInsertLegacyAuditEvent(
      ctx,
      {
        organization_id: ctx.orgId,
        contract_id: null,
        user_id: ctx.user.id,
        action: "onboarding.post_calibration_mode_changed",
        details: {
          prev_workspace_mode: prevMode,
          next_workspace_mode: nextModeFinal,
        },
      }
    );
    if (calibrationAuditError) return calibrationAuditError;
  }

  const legacyAuditError = await safeInsertLegacyAuditEvent(
    ctx,
    {
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
    }
  );
  if (legacyAuditError) return legacyAuditError;
  const v10AuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.user.id,
    action: "workspace.mode_updated",
    targetType: "setting",
    targetId: "workspace_product_surface",
    outcome: "success",
    safeMetadata: {
      prev_workspace_mode: prevMode,
      next_workspace_mode: nextModeFinal,
      hidden_advanced_count: (merged?.advanced_modules_hidden ?? []).length,
      hidden_assurance_count: (merged?.assurance_modules_hidden ?? []).length,
      hidden_utility_count: (merged?.utility_modules_hidden ?? []).length,
    },
  });
  if (!v10AuditEventId) {
    console.error("[product-surface-settings] V10 workspace mode audit evidence could not be recorded.");
  }
  const moduleVisibilityChanged =
    JSON.stringify(prevV6.advanced_modules_hidden ?? []) !== JSON.stringify(merged?.advanced_modules_hidden ?? []) ||
    JSON.stringify(prevV6.assurance_modules_hidden ?? []) !== JSON.stringify(merged?.assurance_modules_hidden ?? []) ||
    JSON.stringify(prevV6.utility_modules_hidden ?? []) !== JSON.stringify(merged?.utility_modules_hidden ?? []);
  if (moduleVisibilityChanged) {
    const moduleAuditEventId = await recordV10AuditEvent(ctx.admin, {
      organizationId: ctx.orgId,
      actorUserId: ctx.user.id,
      action: "workspace.module_visibility_updated",
      targetType: "setting",
      targetId: "workspace_product_surface_modules",
      outcome: "success",
      safeMetadata: {
        hidden_advanced_count: (merged?.advanced_modules_hidden ?? []).length,
        hidden_assurance_count: (merged?.assurance_modules_hidden ?? []).length,
        hidden_utility_count: (merged?.utility_modules_hidden ?? []).length,
      },
    });
    if (!moduleAuditEventId) {
      console.error("[product-surface-settings] V10 module visibility audit evidence could not be recorded.");
    }
  }
  await refreshV10SettingsReadModels(ctx.admin, ctx.orgId);

  revalidatePath("/settings");
  revalidatePath("/settings/product");
  revalidatePath("/dashboard");
  revalidatePath("/more");
  revalidatePath("/onboarding/calibration");
  return { success: true as const };
}

export async function resetWorkspaceProductSurfaceDefaultsForm(): Promise<ProductSurfaceActionResult> {
  return recoverProductSurfaceAction("resetWorkspaceProductSurfaceDefaultsForm", () =>
    resetWorkspaceProductSurfaceDefaultsFormUnsafe()
  );
}

async function resetWorkspaceProductSurfaceDefaultsFormUnsafe(): Promise<ProductSurfaceActionResult> {
  const eligibility = await requireServerActionEligibility({
    actionId: "product-surface-settings:resetWorkspaceProductSurfaceDefaultsForm",
    featureFamily: "settings",
  });
  if (!eligibility.ok) return { error: "This workspace cannot reset product experience settings right now." };

  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { error: "Only workspace admins can reset product experience settings." };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevVersion = JSON.stringify(prevV6);
  const prevMode = parseWorkspaceMode(prevV6);
  const patch: V6OrgSettingsMergePatch = {
    workspace_mode: "core",
    default_landing_path: "",
    search_scope: "match_mode",
    advanced_modules_hidden: [...ALL_ADVANCED_NAV_MODULE_KEYS],
    assurance_modules_hidden: [...ALL_ASSURANCE_NAV_MODULE_KEYS],
    utility_modules_hidden: [],
    home_hidden_sections: [],
    advanced_nav_roles: null,
    assurance_nav_roles: null,
    assurance_nav_admin_testing: false,
    autopilot_allow_execution: false,
  };
  const v10Reservation = await reserveV10SettingsMutation(ctx, {
    mutationName: "update_workspace_mode",
    targetId: "workspace_product_surface_defaults",
    currentVersion: prevVersion,
    payload: {
      reset_to: "core_defaults",
      hidden_advanced_count: ALL_ADVANCED_NAV_MODULE_KEYS.length,
      hidden_assurance_count: ALL_ASSURANCE_NAV_MODULE_KEYS.length,
    },
  });
  if (v10Reservation) return v10Reservation;
  const v10ModuleReservation = await reserveV10SettingsMutation(ctx, {
    mutationName: "update_module_visibility",
    targetId: "workspace_product_surface_modules",
    currentVersion: prevVersion,
    payload: {
      reset_to: "core_module_defaults",
      hidden_advanced_count: ALL_ADVANCED_NAV_MODULE_KEYS.length,
      hidden_assurance_count: ALL_ASSURANCE_NAV_MODULE_KEYS.length,
      hidden_utility_count: 0,
    },
  });
  if (v10ModuleReservation) return v10ModuleReservation;
  const { data: merged, error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, patch);
  if (error) return { error: error.message };
  await safeApplyWorkspaceProductTransitionSideEffects({
    admin: ctx.admin,
    orgId: ctx.orgId,
    userId: ctx.user.id,
    prevMode,
    nextMode: "core",
  });
  const legacyAuditError = await safeInsertLegacyAuditEvent(
    ctx,
    {
      organization_id: ctx.orgId,
      contract_id: null,
      user_id: ctx.user.id,
      action: "workspace.product_surface_reset_defaults",
      details: {
        prev_workspace_mode: prevMode,
        next_workspace_mode: parseWorkspaceMode(merged ?? prevV6),
      },
    }
  );
  if (legacyAuditError) return legacyAuditError;
  const v10AuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.user.id,
    action: "workspace.mode_updated",
    targetType: "setting",
    targetId: "workspace_product_surface_defaults",
    outcome: "success",
    safeMetadata: {
      prev_workspace_mode: prevMode,
      next_workspace_mode: parseWorkspaceMode(merged ?? prevV6),
      hidden_advanced_count: ALL_ADVANCED_NAV_MODULE_KEYS.length,
      hidden_assurance_count: ALL_ASSURANCE_NAV_MODULE_KEYS.length,
      hidden_utility_count: 0,
    },
  });
  if (!v10AuditEventId) {
    console.error("[product-surface-settings] V10 reset audit evidence could not be recorded.");
  }
  const moduleAuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.user.id,
    action: "workspace.module_visibility_updated",
    targetType: "setting",
    targetId: "workspace_product_surface_modules",
    outcome: "success",
    safeMetadata: {
      hidden_advanced_count: ALL_ADVANCED_NAV_MODULE_KEYS.length,
      hidden_assurance_count: ALL_ASSURANCE_NAV_MODULE_KEYS.length,
      hidden_utility_count: 0,
    },
  });
  if (!moduleAuditEventId) {
    console.error("[product-surface-settings] V10 reset module visibility audit evidence could not be recorded.");
  }
  await refreshV10SettingsReadModels(ctx.admin, ctx.orgId);
  revalidatePath("/settings");
  revalidatePath("/settings/product");
  revalidatePath("/dashboard");
  revalidatePath("/more");
  revalidatePath("/onboarding/calibration");
  return { success: true as const };
}

/** Merge email notification `blocked_types` for known keys (product-surface policy §18.1 / §21). */
export async function updateProductEmailNotificationCategoriesForm(formData: FormData): Promise<ProductSurfaceActionResult> {
  return recoverProductSurfaceAction("updateProductEmailNotificationCategoriesForm", () =>
    updateProductEmailNotificationCategoriesFormUnsafe(formData)
  );
}

async function updateProductEmailNotificationCategoriesFormUnsafe(formData: FormData): Promise<ProductSurfaceActionResult> {
  const eligibility = await requireServerActionEligibility({
    actionId: "product-surface-settings:updateProductEmailNotificationCategoriesForm",
    featureFamily: "settings",
  });
  if (!eligibility.ok) return { error: "Not eligible" };

  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { error: "Unauthorized" };

  const muted = EMAIL_NOTIFICATION_POLICY_TYPES.filter((notificationType) =>
    formData.get(`mute_email_${notificationType}`) === "on"
  );
  const { data: row } = await ctx.admin
    .from("organization_workflow_settings")
    .select("notification_policy_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  const prev = (row?.notification_policy_json ?? {}) as Record<string, unknown>;
  const prevVersion = JSON.stringify(prev);
  const prevEmail = (prev.email ?? {}) as Record<string, unknown>;
  const prevBlocked = Array.isArray(prevEmail.blocked_types)
    ? (prevEmail.blocked_types as unknown[]).map((v) => String(v))
    : [];
  const nextBlocked = [...new Set(muted)];

  const nextPolicy = {
    ...prev,
    email: {
      ...prevEmail,
      blocked_types: nextBlocked,
    },
  };

  const v10Reservation = await reserveV10SettingsMutation(ctx, {
    mutationName: "update_notification_preferences",
    targetId: "workspace_email_notification_categories",
    currentVersion: prevVersion,
    payload: {
      channel: "email",
      muted_known_category_count: muted.length,
      blocked_type_count: nextBlocked.length,
    },
  });
  if (v10Reservation) return v10Reservation;

  const { error } = await ctx.admin
    .from("organization_workflow_settings")
    .update({ notification_policy_json: nextPolicy })
    .eq("organization_id", ctx.orgId);

  if (error) {
    console.error("[product-surface-settings] notification categories", error.message);
    return { error: error.message };
  }

  const legacyAuditError = await safeInsertLegacyAuditEvent(
    ctx,
    {
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
    }
  );
  if (legacyAuditError) return legacyAuditError;
  const v10AuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.user.id,
    action: "notification_preferences.updated",
    targetType: "setting",
    targetId: "workspace_email_notification_categories",
    outcome: "success",
    safeMetadata: {
      channel: "email",
      muted_known_category_count: muted.length,
      blocked_type_count: nextBlocked.length,
    },
  });
  if (!v10AuditEventId) {
    console.error("[product-surface-settings] V10 notification audit evidence could not be recorded.");
  }
  await refreshV10SettingsReadModels(ctx.admin, ctx.orgId);

  revalidatePath("/settings/product");
  revalidatePath("/settings/operations");
  return { success: true as const };
}
