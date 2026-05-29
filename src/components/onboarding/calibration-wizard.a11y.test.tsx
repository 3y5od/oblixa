/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationWizard } from "@/components/onboarding/calibration-wizard";
import { stepLabels } from "@/lib/onboarding/calibration-copy";

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

describe("CalibrationWizard — focus after Next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    cleanup();
  });

  it("moves focus to the step title after advancing from step 0", async () => {
    const user = userEvent.setup();
    render(<CalibrationWizard initialRequired={{}} initialOptional={{}} initialStep={0} />);

    await user.click(screen.getByRole("radio", { name: /Upload signed contracts and track dates/i }));

    await user.click(screen.getByRole("button", { name: "Next" }));

    const title = await screen.findByRole("heading", {
      level: 1,
      name: stepLabels.team_model,
    });
    expect(document.activeElement).toBe(title);
  });
});
