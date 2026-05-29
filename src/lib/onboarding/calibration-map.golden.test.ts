import { describe, expect, it } from "vitest";
import { getFeatureFlags, type FeatureFlagKey } from "@/lib/feature-flags";
import type { CalibrationAnswersOptional, CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import {
  finalizeRecommendation,
  recommendationToV6Patch,
  resolveWorkspaceMode,
} from "@/lib/onboarding/calibration-map";

const flags = getFeatureFlags();

function base(overrides: Partial<CalibrationAnswersRequired> = {}): CalibrationAnswersRequired {
  return {
    primary_use_case: "track_contracts_dates",
    team_model: "solo",
    workflow_maturity: "manual_spreadsheet",
    main_pain: "find_contracts_dates",
    complexity_preference: "simplest",
    setup_intent: "upload_import",
    assurance_intent: "not_now",
    ...overrides,
  };
}

type GoldenRow = {
  name: string;
  req: CalibrationAnswersRequired;
  opt?: CalibrationAnswersOptional;
  exp: {
    mode: ReturnType<typeof resolveWorkspaceMode>;
    landing: string;
    search: "core_only" | "match_mode";
    dashboardProfile: string;
    autopilot: boolean;
  };
  /** When set, assert `recommended_setup_checklist` exactly (ordering-sensitive). */
  checklist?: string[];
};

describe("calibration-map golden vectors", () => {
  const rows: GoldenRow[] = [
    {
      name: "baseline core simplest",
      req: base(),
      checklist: ["upload_contract", "review_fields"],
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "simplest caps coordination to core",
      req: base({ primary_use_case: "coordinate_renewals_decisions" }),
      exp: { mode: "core", landing: "/contracts/new", search: "core_only", dashboardProfile: "core", autopilot: false },
    },
    {
      name: "coordinate + more_if_helps tends advanced",
      req: base({
        primary_use_case: "coordinate_renewals_decisions",
        complexity_preference: "more_if_helps",
      }),
      exp: {
        mode: "advanced",
        landing: "/contracts/new",
        search: "match_mode",
        dashboardProfile: "advanced",
        autopilot: false,
      },
    },
    {
      name: "setup review_extracted_fields",
      req: base({ setup_intent: "review_extracted_fields" }),
      checklist: ["review_fields", "upload_contract"],
      exp: {
        mode: "core",
        landing: "/contracts/review",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "setup organize_work_renewals",
      req: base({ setup_intent: "organize_work_renewals" }),
      checklist: ["organize_work", "upload_contract"],
      exp: {
        mode: "core",
        landing: "/work",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "setup configure_workflows_advanced",
      req: base({ setup_intent: "configure_workflows_advanced", complexity_preference: "more_if_helps" }),
      checklist: ["organize_work", "upload_contract", "product_settings"],
      exp: {
        mode: "core",
        landing: "/settings/operations",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "high import volume bulk landing",
      req: base(),
      opt: { import_volume: "high" },
      checklist: ["bulk_import", "upload_contract", "review_fields"],
      exp: {
        mode: "core",
        landing: "/contracts/bulk",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "regulated industry emphasis prepends compliance_alignment",
      req: base(),
      opt: { industry_emphasis: "regulated" },
      checklist: ["compliance_alignment", "upload_contract", "review_fields"],
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "legal_ops org_role review landing",
      req: base(),
      opt: { org_role: "legal_ops" },
      exp: {
        mode: "core",
        landing: "/contracts/review",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "exec org_role dashboard landing",
      req: base(),
      opt: { org_role: "exec" },
      exp: {
        mode: "core",
        landing: "/dashboard",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "tasks primary stays core simplest",
      req: base({ primary_use_case: "tasks_approvals_obligations" }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "large team + comfortable_advanced",
      req: base({
        team_model: "large_cross_functional",
        complexity_preference: "comfortable_advanced",
        primary_use_case: "tasks_approvals_obligations",
      }),
      exp: {
        mode: "advanced",
        landing: "/contracts/new",
        search: "match_mode",
        dashboardProfile: "advanced",
        autopilot: false,
      },
    },
    {
      name: "assurance primary + full_visibility + yes assurance strong signals",
      req: base({
        primary_use_case: "assurance_control_workflows",
        complexity_preference: "full_visibility",
        assurance_intent: "yes_workspace",
        workflow_maturity: "highly_structured_policy",
        main_pain: "risk_drift_control",
      }),
      exp: {
        mode: "assurance",
        landing: "/contracts/new",
        search: "match_mode",
        dashboardProfile: "assurance_lite",
        autopilot: false,
      },
    },
    {
      name: "assurance intent yes but simplest caps to core",
      req: base({
        assurance_intent: "yes_workspace",
        complexity_preference: "simplest",
        primary_use_case: "track_contracts_dates",
      }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "maybe_later assurance with weak signals core",
      req: base({ assurance_intent: "maybe_later", complexity_preference: "more_if_helps" }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "well_defined_cross_team pain decisions_handoffs advanced",
      req: base({
        workflow_maturity: "well_defined_cross_team",
        main_pain: "decisions_handoffs",
        complexity_preference: "more_if_helps",
      }),
      exp: {
        mode: "advanced",
        landing: "/contracts/new",
        search: "match_mode",
        dashboardProfile: "advanced",
        autopilot: false,
      },
    },
    {
      name: "full_visibility without assurance primary stays advanced not assurance",
      req: base({
        complexity_preference: "full_visibility",
        primary_use_case: "coordinate_renewals_decisions",
        assurance_intent: "not_now",
      }),
      exp: {
        mode: "advanced",
        landing: "/contracts/new",
        search: "match_mode",
        dashboardProfile: "advanced",
        autopilot: false,
      },
    },
    {
      name: "simplest + configure advanced still core mode",
      req: base({
        complexity_preference: "simplest",
        setup_intent: "configure_workflows_advanced",
      }),
      exp: {
        mode: "core",
        landing: "/settings/operations",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "medium team manual pain core",
      req: base({ team_model: "medium_6_20", main_pain: "tasks_obligations" }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "risk_drift_control pain simplest stays core",
      req: base({ main_pain: "risk_drift_control", complexity_preference: "simplest" }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "more_if_helps + highly_structured_policy",
      req: base({
        complexity_preference: "more_if_helps",
        workflow_maturity: "highly_structured_policy",
        primary_use_case: "tasks_approvals_obligations",
      }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "small_2_5 team default",
      req: base({ team_model: "small_2_5" }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
    {
      name: "somewhat_structured maturity",
      req: base({ workflow_maturity: "somewhat_structured" }),
      exp: {
        mode: "core",
        landing: "/contracts/new",
        search: "core_only",
        dashboardProfile: "core",
        autopilot: false,
      },
    },
  ];

  it.each(rows)("$name: resolveWorkspaceMode", ({ req, exp }) => {
    expect(resolveWorkspaceMode(req)).toBe(exp.mode);
  });

  it.each(rows)("$name: finalizeRecommendation key fields", ({ req, opt: optionalAnswers, exp, checklist }) => {
    const rec = finalizeRecommendation(req, flags, optionalAnswers);
    expect(rec.recommended_workspace_mode).toBe(exp.mode);
    expect(rec.recommended_default_landing_path).toBe(exp.landing);
    expect(rec.recommended_search_scope).toBe(exp.search);
    expect(rec.recommended_dashboard_profile).toBe(exp.dashboardProfile);
    if (checklist) {
      expect(rec.recommended_setup_checklist).toEqual(checklist);
    }
    const patch = recommendationToV6Patch(rec);
    expect(patch.autopilot_allow_execution).toBe(exp.autopilot);
    expect(patch.workspace_mode).toBe(exp.mode);
    if (exp.mode === "core") {
      expect(patch.advanced_modules_hidden?.length ?? 0).toBeGreaterThan(0);
    }
    if (exp.mode === "advanced") {
      expect(patch.advanced_modules_hidden?.length ?? 0).toBeLessThan(8);
    }
    if (exp.mode === "assurance") {
      expect(patch.assurance_modules_hidden?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("feature-flag clamp: all flags off forces assurance-strong answers to core (§19.3)", () => {
    const allFalse = Object.fromEntries(
      Object.keys(getFeatureFlags()).map((k) => [k, false])
    ) as Record<FeatureFlagKey, boolean>;
    const assuranceAnswers = base({
      complexity_preference: "full_visibility",
      assurance_intent: "yes_workspace",
      primary_use_case: "assurance_control_workflows",
      workflow_maturity: "highly_structured_policy",
      main_pain: "risk_drift_control",
    });
    expect(resolveWorkspaceMode(assuranceAnswers)).toBe("assurance");
    const rec = finalizeRecommendation(assuranceAnswers, allFalse);
    expect(rec.recommended_workspace_mode).toBe("core");
    expect(recommendationToV6Patch(rec).workspace_mode).toBe("core");
  });
});
