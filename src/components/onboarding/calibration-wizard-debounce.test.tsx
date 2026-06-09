/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationWizard } from "@/components/onboarding/calibration-wizard";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();

const actionMocks = vi.hoisted(() => ({
  recordQuestionnaireStarted: vi.fn(async () => ({ ok: true })),
  saveQuestionnaireProgress: vi.fn(async () => ({ ok: true })),
  previewCalibrationRecommendation: vi.fn(),
  completeQuestionnaireAcceptRecommendation: vi.fn(async () => ({ ok: true })),
  completeQuestionnaireSimplerSetup: vi.fn(async () => ({ ok: true })),
  completeQuestionnaireOpenAdvancedSettings: vi.fn(async () => ({ ok: true })),
  skipQuestionnaireExplicitMinimal: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

vi.mock("@/actions/onboarding-calibration", () => actionMocks);

describe("CalibrationWizard — debounced save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    actionMocks.previewCalibrationRecommendation.mockResolvedValue({
      ok: true,
      recommendation: {
        recommended_workspace_mode: "core",
        recommended_advanced_families_enabled: [],
        recommended_assurance_families_enabled: [],
        recommended_default_landing_path: "/contracts/new",
        recommended_dashboard_profile: "core",
        recommended_search_scope: "core_only",
        recommended_notification_profile: { suppress_advanced_tiers: true },
        recommended_report_profile: {
          suppress_incompatible_subscriptions: true,
          aligns_with_workspace_transition: true,
        },
        recommended_setup_checklist: ["upload_contract"],
        recommended_utility_modules_hidden: [],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does not call saveQuestionnaireProgress on every immediate optional change (debounced)", async () => {
    const full = {
      primary_use_case: "track_contracts_dates" as const,
      team_model: "solo" as const,
      workflow_maturity: "manual_spreadsheet" as const,
      main_pain: "find_contracts_dates" as const,
      complexity_preference: "simplest" as const,
      setup_intent: "upload_import" as const,
      assurance_intent: "not_now" as const,
    };

    render(<CalibrationWizard initialRequired={full} initialOptional={{}} initialStep={7} />);

    actionMocks.saveQuestionnaireProgress.mockClear();

    // Industry is now a custom combobox (FormSelect): open the trigger (named via
    // its label) and click option rows, instead of native selectOptions.
    // fireEvent is synchronous, so it does not advance the fake debounce timer.
    const openIndustry = () =>
      fireEvent.click(screen.getByRole("button", { name: /industry emphasis/i }));
    openIndustry();
    fireEvent.click(screen.getByRole("option", { name: /software \/ saas/i }));
    openIndustry();
    fireEvent.click(screen.getByRole("option", { name: /regulated industry/i }));
    openIndustry();
    fireEvent.click(screen.getByRole("option", { name: /^other$/i }));

    expect(actionMocks.saveQuestionnaireProgress).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(450);

    expect(actionMocks.saveQuestionnaireProgress).toHaveBeenCalledTimes(1);
  });
});
