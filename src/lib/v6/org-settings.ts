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

export type V6OrgSettingsJson = {
  /** Product surface mode (docs/refinement.md). Default: core when unset. */
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
  /** Post-signup questionnaire state + answers (docs/onboarding.md); separate from applied surface fields. */
  onboarding_calibration?: OnboardingCalibrationState;
};

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
  return raw as V6OrgSettingsJson;
}

function sanitizeWorkspaceMode(v: unknown): WorkspaceProductMode | undefined {
  if (v === "core" || v === "advanced" || v === "assurance") return v;
  return undefined;
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
    const allowed: AdvancedNavModuleKey[] = [
      "decisions",
      "campaigns",
      "programs",
      "relationships",
      "analytics",
      "maintenance",
      "collaboration",
      "compare_views",
    ];
    next.advanced_modules_hidden = patch.advanced_modules_hidden.filter((k) => allowed.includes(k));
  }
  if (patch.assurance_modules_hidden != null) {
    const allowed: AssuranceNavModuleKey[] = [
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
    next.assurance_modules_hidden = patch.assurance_modules_hidden.filter((k) =>
      allowed.includes(k)
    );
  }
  if (patch.utility_modules_hidden != null) {
    const allowed: UtilityModuleKey[] = [
      "intake",
      "data_quality",
      "review_cadence",
      "watchlists",
      "execution_graph",
      "approval_workload",
      "approval_sla_simulator",
      "more_tools",
    ];
    next.utility_modules_hidden = patch.utility_modules_hidden.filter((k) => allowed.includes(k));
  }
  if (Object.prototype.hasOwnProperty.call(patch, "advanced_nav_roles")) {
    if (patch.advanced_nav_roles == null) {
      delete next.advanced_nav_roles;
    } else {
      const roles = new Set([
        "admin",
        "editor",
        "viewer",
        "ops_manager",
        "legal_reviewer",
        "finance_reviewer",
        "manager",
      ]);
      next.advanced_nav_roles = patch.advanced_nav_roles.filter((r) => roles.has(r));
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "assurance_nav_roles")) {
    if (patch.assurance_nav_roles == null) {
      delete next.assurance_nav_roles;
    } else {
      const roles = new Set([
        "admin",
        "editor",
        "viewer",
        "ops_manager",
        "legal_reviewer",
        "finance_reviewer",
        "manager",
      ]);
      next.assurance_nav_roles = patch.assurance_nav_roles.filter((r) => roles.has(r));
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
  return { data: (raw && typeof raw === "object" ? raw : next) as V6OrgSettingsJson, error: null };
}

/** Mutating autopilot only in assurance mode with explicit org opt-in (docs/refinement.md §17.2). */
export async function isOrgAutopilotExecutionAllowed(admin: AdminClient, orgId: string): Promise<boolean> {
  const s = await getV6OrgSettingsJson(admin, orgId);
  const mode = s.workspace_mode;
  if (mode !== "assurance") return false;
  return s.autopilot_allow_execution === true;
}
