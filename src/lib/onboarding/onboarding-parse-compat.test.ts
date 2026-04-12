import { describe, expect, it } from "vitest";
import { parseOnboardingCalibration } from "@/lib/onboarding/calibration-types";

describe("parseOnboardingCalibration read compat (JSON version ladder)", () => {
  it("accepts v1-shaped payloads without recommended_report_profile on last_recommendation (UI supplies defaults)", () => {
    const parsed = parseOnboardingCalibration({
      version: 1,
      blocking_required: false,
      status: "completed",
      // v1 writers omitted recommended_report_profile; readers treat missing profile as Core-safe defaults in UI.
      last_recommendation: {
        recommended_workspace_mode: "core",
        recommended_advanced_families_enabled: [],
        recommended_assurance_families_enabled: [],
        recommended_default_landing_path: "/dashboard",
        recommended_dashboard_profile: "core",
        recommended_search_scope: "core_only",
        recommended_notification_profile: { suppress_advanced_tiers: true },
        recommended_setup_checklist: [],
        recommended_utility_modules_hidden: [],
      } as unknown,
    });
    expect(parsed?.status).toBe("completed");
    expect(parsed?.last_recommendation).toBeDefined();
  });

  it("accepts v2-shaped payloads with history, last_applied, and report_profile on last_recommendation", () => {
    const parsed = parseOnboardingCalibration({
      version: 2,
      blocking_required: false,
      status: "completed",
      questionnaire_completed_at: "2026-01-15T12:00:00.000Z",
      history: [
        {
          at: "2026-01-15T12:00:00.000Z",
          actor_user_id: "11111111-1111-1111-1111-111111111111",
          prior_mode: "core",
          next_mode: "advanced",
          choice: "accept",
        },
      ],
      last_applied: {
        applied_at: "2026-01-15T12:00:00.000Z",
        applied_by_user_id: "11111111-1111-1111-1111-111111111111",
        applied_workspace_mode: "advanced",
        advanced_modules_hidden: ["campaigns"],
        assurance_modules_hidden: ["findings"],
        utility_modules_hidden: ["intake"],
        home_hidden_sections: ["outcome_intelligence"],
        search_scope: "match_mode",
        default_landing_path: "/dashboard",
      },
      last_recommendation: {
        recommended_workspace_mode: "advanced",
        recommended_advanced_families_enabled: ["decisions"],
        recommended_assurance_families_enabled: [],
        recommended_default_landing_path: "/dashboard",
        recommended_dashboard_profile: "advanced",
        recommended_search_scope: "match_mode",
        recommended_notification_profile: { suppress_advanced_tiers: false },
        recommended_report_profile: {
          suppress_incompatible_subscriptions: false,
          aligns_with_workspace_transition: true,
        },
        recommended_setup_checklist: ["upload_contract"],
        recommended_utility_modules_hidden: [],
      },
    });
    expect(parsed?.version).toBe(2);
    expect(parsed?.history?.length).toBe(1);
    expect(parsed?.last_applied?.search_scope).toBe("match_mode");
    expect(parsed?.last_recommendation?.recommended_report_profile?.aligns_with_workspace_transition).toBe(
      true
    );
  });

  it("rejects unknown status and non-numeric version", () => {
    expect(
      parseOnboardingCalibration({
        version: 2,
        blocking_required: true,
        status: "archived",
      } as unknown)
    ).toBeUndefined();
    expect(
      parseOnboardingCalibration({
        version: "2",
        blocking_required: false,
        status: "pending",
      } as unknown)
    ).toBeUndefined();
  });
});
