/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationWizard } from "@/components/onboarding/calibration-wizard";
import type { CalibrationRecommendation } from "@/lib/onboarding/calibration-types";
import {
  actionApply,
  actionSettings,
  actionSimpler,
  calibrationReviewTestIds,
  labelForNotificationSuppressAdvanced,
  labelForSearchScope,
  reviewSectionHeadings,
  reviewStepTitle,
  setupChecklistKeyLabels,
  stepLabels,
} from "@/lib/onboarding/calibration-copy";

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

const mockRec: CalibrationRecommendation = {
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
};

const fullReq = {
  primary_use_case: "track_contracts_dates" as const,
  team_model: "solo" as const,
  workflow_maturity: "manual_spreadsheet" as const,
  main_pain: "find_contracts_dates" as const,
  complexity_preference: "simplest" as const,
  setup_intent: "upload_import" as const,
  assurance_intent: "not_now" as const,
};

describe("CalibrationWizard — review & outcomes (jsdom)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.previewCalibrationRecommendation.mockResolvedValue({ ok: true, recommendation: mockRec });
  });

  afterEach(() => {
    cleanup();
  });

  function reviewSection() {
    const heading = screen.getByRole("heading", { level: 1, name: reviewStepTitle });
    const section = heading.closest("section");
    if (!section) throw new Error("expected review section");
    return section;
  }

  it("review step shows recommended mode label, landing, and three primary actions", async () => {
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    expect(screen.getByRole("heading", { level: 1, name: reviewStepTitle })).toBeTruthy();
    expect(screen.getByText(/Recommended workspace mode/i)).toBeTruthy();
    expect(screen.getByText(/\(recommended\)/)).toBeTruthy();
    const section = reviewSection();
    const applyBtn = within(section).getByRole("button", { name: actionApply }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
    expect(within(section).getByRole("button", { name: actionSimpler })).toBeTruthy();
    expect(within(section).getByRole("button", { name: actionSettings })).toBeTruthy();
  });

  it("Apply recommendation stays disabled until preview resolves", async () => {
    actionMocks.previewCalibrationRecommendation.mockImplementation(() => new Promise(() => {}));
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    const section = reviewSection();
    const applyBtn = within(section).getByRole("button", { name: actionApply }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
  });

  it("successful Apply calls complete action and router.replace to /dashboard", async () => {
    const user = userEvent.setup();
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    await user.click(within(reviewSection()).getByRole("button", { name: actionApply }));
    await waitFor(() =>
      expect(actionMocks.completeQuestionnaireAcceptRecommendation).toHaveBeenCalled()
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });

  it("focuses the step heading after landing on review", async () => {
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    const heading = (await screen.findByRole("heading", {
      level: 1,
      name: reviewStepTitle,
    })) as HTMLHeadingElement;
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("required-step option labels expose min-h-9 touch target class", () => {
    render(<CalibrationWizard initialRequired={{}} initialOptional={{}} initialStep={0} />);
    const firstOption = screen.getAllByRole("radio")[0]!;
    const label = firstOption.closest("label");
    expect(label?.className).toMatch(/min-h-9/);
  });

  it("exposes aria-live polite region for preview/action errors", () => {
    const { container } = render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
  });

  it("root applies motion-reduce transition guard class", () => {
    const { container } = render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/motion-reduce:transition-none/);
  });

  it("advancing a step moves focus to the next step heading", async () => {
    const user = userEvent.setup();
    render(<CalibrationWizard initialRequired={{}} initialOptional={{}} initialStep={0} />);
    const first = screen.getAllByRole("radio")[0]!;
    await user.click(first);
    await user.click(screen.getByRole("button", { name: "Next" }));
    const nextHeading = (await screen.findByRole("heading", {
      level: 1,
      name: stepLabels.team_model,
    })) as HTMLHeadingElement;
    await waitFor(() => expect(document.activeElement).toBe(nextHeading));
  });

  it("while a review outcome is in-flight, primary outcome buttons are disabled", async () => {
    const user = userEvent.setup();
    actionMocks.completeQuestionnaireSimplerSetup.mockImplementation(() => new Promise(() => {}));
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    const section = reviewSection();
    await user.click(within(section).getByRole("button", { name: actionSimpler }));
    await waitFor(() => {
      expect(
        (within(section).getByRole("button", { name: actionApply }) as HTMLButtonElement).disabled
      ).toBe(true);
      expect(
        (within(section).getByRole("button", { name: actionSettings }) as HTMLButtonElement).disabled
      ).toBe(true);
    });
  });

  it("failed outcome surfaces text in the aria-live region", async () => {
    const user = userEvent.setup();
    actionMocks.completeQuestionnaireAcceptRecommendation.mockResolvedValue(
      { ok: false, error: "Server rejected apply." } as { ok: false; error: string }
    );
    const { container } = render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    await user.click(within(reviewSection()).getByRole("button", { name: actionApply }));
    const live = await waitFor(() => container.querySelector('[aria-live="polite"]'));
    expect(live?.textContent).toContain("Server rejected apply.");
  });

  it("review snapshot has no serious or critical axe wcag2a violations", async () => {
    actionMocks.previewCalibrationRecommendation.mockResolvedValue({ ok: true, recommendation: mockRec });
    render(<CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />);
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    await screen.findByText(/Recommended workspace mode/i);
    const results = await axe.run(reviewSection(), {
      runOnly: { type: "tag", values: ["wcag2a"] },
    });
    const bad = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(bad).toHaveLength(0);
  });

  it("review exposes stable test ids and subsection headings", async () => {
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    expect(screen.getByTestId(calibrationReviewTestIds.root)).toBeTruthy();
    expect(screen.getByTestId(calibrationReviewTestIds.setup)).toBeTruthy();
    expect(screen.getByRole("heading", { name: reviewSectionHeadings.setup })).toBeTruthy();
    expect(screen.getByText(setupChecklistKeyLabels.upload_contract)).toBeTruthy();
    expect(screen.getByText(labelForSearchScope("match_mode"))).toBeTruthy();
    expect(
      screen.getByText(labelForNotificationSuppressAdvanced(false))
    ).toBeTruthy();
  });

  it("review shows core-only search scope and utility hides when preview says so", async () => {
    actionMocks.previewCalibrationRecommendation.mockResolvedValue({
      ok: true,
      recommendation: {
        ...mockRec,
        recommended_workspace_mode: "core",
        recommended_search_scope: "core_only",
        recommended_advanced_families_enabled: [],
        recommended_dashboard_profile: "core",
        recommended_notification_profile: { suppress_advanced_tiers: true },
        recommended_report_profile: {
          suppress_incompatible_subscriptions: true,
          aligns_with_workspace_transition: true,
        },
        recommended_utility_modules_hidden: ["intake"],
      },
    });
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    expect(screen.getByText(labelForSearchScope("core_only"))).toBeTruthy();
    expect(screen.getByText(/Hidden: Intake/)).toBeTruthy();
    expect(
      screen.getByText(labelForNotificationSuppressAdvanced(true))
    ).toBeTruthy();
  });
});
