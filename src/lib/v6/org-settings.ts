import type { AdminClient } from "@/lib/v6/service";
import type { WorkspaceRole } from "@/lib/navigation";
import { isValidDefaultLandingPath } from "@/lib/product-surface/landing-eligibility";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  ProductSearchScope,
  UtilityModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";
import type { OnboardingCalibrationState } from "@/lib/onboarding/calibration-types";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
  ALL_UTILITY_MODULE_KEYS,
  isAdvancedNavModuleKey,
  isAssuranceNavModuleKey,
  isUtilityModuleKey,
  isWorkspaceNavRole,
} from "@/lib/product-surface/workspace-module-keys";

export type V6OrgSettingsJson = {
  /** Product surface mode (product-surface policy). Default: core when unset. */
  workspace_mode?: WorkspaceProductMode;
  /** Post-login landing path (must start with `/`). */
  default_landing_path?: string;
  /** Hide specific advanced modules even when workspace is advanced/assurance. */
  advanced_modules_hidden?: AdvancedNavModuleKey[];
  /** Hide specific assurance modules even in assurance mode. */
  assurance_modules_hidden?: AssuranceNavModuleKey[];
  /** Hide utility families from contextual entry surfaces. */
  utility_modules_hidden?: UtilityModuleKey[];
  /** If set, only these roles see advanced primary nav items; otherwise role defaults apply. */
  advanced_nav_roles?: WorkspaceRole[];
  /** If set in Assurance mode, only these roles see the Assurance nav section; otherwise admin/ops/manager defaults apply. */
  assurance_nav_roles?: WorkspaceRole[];
  /** Admin-only: show Assurance nav outside assurance mode (testing). */
  assurance_nav_admin_testing?: boolean;
  /** When false, autopilot will not perform mutating actions for this org (dry-runs still allowed). */
  autopilot_allow_execution?: boolean;
  /** Optional emails for future review-board digests (stored only until delivery is wired). */
  review_board_notification_emails?: string[];
  /** Suppress outbound_events.event_type values regardless of tier (admin tuning). */
  notification_suppressed_event_types?: string[];
  /** Dashboard section keys to hide on home (refinement §21.1). */
  home_hidden_sections?: string[];
  /** Search scope policy for command/global search eligibility. */
  search_scope?: ProductSearchScope;
  /** Post-signup questionnaire state + answers (onboarding spec); separate from applied surface fields. */
  onboarding_calibration?: OnboardingCalibrationState;
};

function sanitizeWorkspaceMode(v: unknown): WorkspaceProductMode | undefined {
  if (v === "core" || v === "advanced" || v === "assurance") return v;
  return undefined;
}

function normalizeStringList(value: unknown, maxLength: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((v): v is string => typeof v === "string" && v.length > 0 && v.length < maxLength);
}

export function normalizeV6OrgSettingsJson(raw: V6OrgSettingsJson): V6OrgSettingsJson {
  const next: V6OrgSettingsJson = { ...raw };
  const mode = sanitizeWorkspaceMode(raw.workspace_mode);
  if (mode) {
    next.workspace_mode = mode;
  } else {
    delete next.workspace_mode;
  }

  if (Array.isArray(raw.advanced_modules_hidden)) {
    next.advanced_modules_hidden = raw.advanced_modules_hidden.filter(isAdvancedNavModuleKey);
  } else {
    delete next.advanced_modules_hidden;
  }
  if (Array.isArray(raw.assurance_modules_hidden)) {
    next.assurance_modules_hidden = raw.assurance_modules_hidden.filter(isAssuranceNavModuleKey);
  } else {
    delete next.assurance_modules_hidden;
  }
  if (Array.isArray(raw.utility_modules_hidden)) {
    next.utility_modules_hidden = raw.utility_modules_hidden.filter(isUtilityModuleKey);
  } else {
    delete next.utility_modules_hidden;
  }

  if (Array.isArray(raw.advanced_nav_roles)) {
    next.advanced_nav_roles = raw.advanced_nav_roles.filter(isWorkspaceNavRole);
  } else {
    delete next.advanced_nav_roles;
  }
  if (Array.isArray(raw.assurance_nav_roles)) {
    next.assurance_nav_roles = raw.assurance_nav_roles.filter(isWorkspaceNavRole);
  } else {
    delete next.assurance_nav_roles;
  }

  if (Object.prototype.hasOwnProperty.call(raw, "assurance_nav_admin_testing")) {
    next.assurance_nav_admin_testing = raw.assurance_nav_admin_testing === true;
  } else {
    delete next.assurance_nav_admin_testing;
  }
  if (Object.prototype.hasOwnProperty.call(raw, "autopilot_allow_execution")) {
    next.autopilot_allow_execution = raw.autopilot_allow_execution === true;
  } else {
    delete next.autopilot_allow_execution;
  }
  if (Object.prototype.hasOwnProperty.call(raw, "search_scope")) {
    next.search_scope = raw.search_scope === "core_only" ? "core_only" : "match_mode";
  } else {
    delete next.search_scope;
  }

  const emails = normalizeStringList(raw.review_board_notification_emails, 321);
  if (emails) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    next.review_board_notification_emails = emails.filter((e) => emailRe.test(e));
  } else {
    delete next.review_board_notification_emails;
  }

  const suppressed = normalizeStringList(raw.notification_suppressed_event_types, 200);
  if (suppressed) {
    next.notification_suppressed_event_types = suppressed;
  } else {
    delete next.notification_suppressed_event_types;
  }

  const hiddenHome = normalizeStringList(raw.home_hidden_sections, 120);
  if (hiddenHome) {
    next.home_hidden_sections = hiddenHome;
  } else {
    delete next.home_hidden_sections;
  }

  if (typeof raw.default_landing_path === "string") {
    const p = raw.default_landing_path.trim();
    const effectiveMode = mode ?? "core";
    if (p.startsWith("/") && isValidDefaultLandingPath(p, effectiveMode)) {
      next.default_landing_path = p;
    } else {
      delete next.default_landing_path;
    }
  } else {
    delete next.default_landing_path;
  }

  if (Object.prototype.hasOwnProperty.call(raw, "onboarding_calibration")) {
    next.onboarding_calibration = raw.onboarding_calibration;
  }

  return next;
}

export async function getV6OrgSettingsJson(
  admin: AdminClient,
  orgId: string
): Promise<V6OrgSettingsJson> {
  const { data, error } = await admin
    .from("organizations")
    .select("v6_org_settings_json")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return {};
  const raw = (data as { v6_org_settings_json?: unknown }).v6_org_settings_json;
  if (!raw || typeof raw !== "object") return {};
  return normalizeV6OrgSettingsJson(raw as V6OrgSettingsJson);
}

export type V6OrgSettingsMergePatch = Omit<
  Partial<V6OrgSettingsJson>,
  "advanced_nav_roles" | "assurance_nav_roles" | "default_landing_path"
> & {
  /** When null, removes stored advanced_nav_roles (revert to role defaults). */
  advanced_nav_roles?: V6OrgSettingsJson["advanced_nav_roles"] | null;
  /** When null, removes stored assurance_nav_roles (revert to role defaults). */
  assurance_nav_roles?: V6OrgSettingsJson["assurance_nav_roles"] | null;
  /** Empty string clears; invalid paths for the effective mode are ignored (prev kept). */
  default_landing_path?: string | null;
};

export async function mergeV6OrgSettingsJson(
  admin: AdminClient,
  orgId: string,
  patch: V6OrgSettingsMergePatch
): Promise<{ data: V6OrgSettingsJson | null; error: { message: string } | null }> {
  const prev = await getV6OrgSettingsJson(admin, orgId);
  const {
    advanced_nav_roles: _omitAdvNav,
    assurance_nav_roles: _omitAsmNav,
    default_landing_path: _omitLand,
    ...patchRest
  } = patch;
  void _omitAdvNav;
  void _omitAsmNav;
  void _omitLand;
  const next: V6OrgSettingsJson = { ...prev, ...patchRest };
  if (patch.workspace_mode != null) {
    const s = sanitizeWorkspaceMode(patch.workspace_mode);
    if (s) {
      next.workspace_mode = s;
    } else if (prev.workspace_mode) {
      next.workspace_mode = prev.workspace_mode;
    } else {
      delete next.workspace_mode;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "default_landing_path")) {
    const raw = patch.default_landing_path;
    const mode = sanitizeWorkspaceMode(next.workspace_mode) ?? "core";
    if (raw == null || raw === "") {
      delete next.default_landing_path;
    } else {
      const p = String(raw).trim();
      if (p.startsWith("/") && isValidDefaultLandingPath(p, mode)) {
        next.default_landing_path = p;
      }
    }
  }
  if (typeof next.default_landing_path === "string") {
    const mode = sanitizeWorkspaceMode(next.workspace_mode) ?? "core";
    if (!isValidDefaultLandingPath(next.default_landing_path, mode)) {
      delete next.default_landing_path;
    }
  }
  if (patch.advanced_modules_hidden != null) {
    next.advanced_modules_hidden = patch.advanced_modules_hidden.filter((k) =>
      ALL_ADVANCED_NAV_MODULE_KEYS.includes(k)
    );
  }
  if (patch.assurance_modules_hidden != null) {
    next.assurance_modules_hidden = patch.assurance_modules_hidden.filter((k) =>
      ALL_ASSURANCE_NAV_MODULE_KEYS.includes(k)
    );
  }
  if (patch.utility_modules_hidden != null) {
    next.utility_modules_hidden = patch.utility_modules_hidden.filter((k) =>
      ALL_UTILITY_MODULE_KEYS.includes(k)
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, "advanced_nav_roles")) {
    if (patch.advanced_nav_roles == null) {
      delete next.advanced_nav_roles;
    } else {
      next.advanced_nav_roles = patch.advanced_nav_roles.filter(isWorkspaceNavRole);
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "assurance_nav_roles")) {
    if (patch.assurance_nav_roles == null) {
      delete next.assurance_nav_roles;
    } else {
      next.assurance_nav_roles = patch.assurance_nav_roles.filter(isWorkspaceNavRole);
    }
  }
  if (patch.review_board_notification_emails != null) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    next.review_board_notification_emails = patch.review_board_notification_emails.filter(
      (e) => typeof e === "string" && e.length <= 320 && emailRe.test(e)
    );
  }
  if (patch.notification_suppressed_event_types != null) {
    next.notification_suppressed_event_types = patch.notification_suppressed_event_types.filter(
      (t) => typeof t === "string" && t.length > 0 && t.length < 200
    );
  }
  if (patch.home_hidden_sections != null) {
    next.home_hidden_sections = patch.home_hidden_sections.filter(
      (k) => typeof k === "string" && k.length > 0 && k.length < 120
    );
  }
  if (patch.search_scope != null) {
    next.search_scope = patch.search_scope === "core_only" ? "core_only" : "match_mode";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "onboarding_calibration")) {
    if (patch.onboarding_calibration === undefined) {
      delete next.onboarding_calibration;
    } else {
      next.onboarding_calibration = patch.onboarding_calibration;
    }
  }
  const { data, error } = await admin
    .from("organizations")
    .update({ v6_org_settings_json: next })
    .eq("id", orgId)
    .select("v6_org_settings_json")
    .maybeSingle();
  if (error) return { data: null, error };
  const raw = (data as { v6_org_settings_json?: unknown } | null)?.v6_org_settings_json;
  return {
    data: raw && typeof raw === "object" ? normalizeV6OrgSettingsJson(raw as V6OrgSettingsJson) : next,
    error: null,
  };
}

/** Mutating autopilot only in assurance mode with explicit org opt-in (product-surface policy §17.2). */
export async function isOrgAutopilotExecutionAllowed(admin: AdminClient, orgId: string): Promise<boolean> {
  const s = await getV6OrgSettingsJson(admin, orgId);
  const mode = s.workspace_mode;
  if (mode !== "assurance") return false;
  return s.autopilot_allow_execution === true;
}
