/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationWizard } from "@/components/onboarding/calibration-wizard";
import type { CalibrationRecommendation } from "@/lib/onboarding/calibration-types";
import {
  actionApply,
  actionSimpler,
  calibrationReviewTestIds,
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

  /** Preview loads in a `useEffect` after `previewCalibrationRecommendation` resolves — await DOM, not only the mock call. */
  async function waitForReviewPreviewRoot() {
    await waitFor(() =>
      expect(actionMocks.previewCalibrationRecommendation).toHaveBeenCalled()
    );
    await screen.findByTestId(calibrationReviewTestIds.root);
  }

  it("review step shows Core-safe result copy and two primary actions", async () => {
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitForReviewPreviewRoot();
    expect(screen.getByRole("heading", { level: 1, name: reviewStepTitle })).toBeTruthy();
    expect(screen.getAllByText(/Your workspace is ready to track contracts/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Recommended workspace mode/i)).toBeNull();
    const section = reviewSection();
    const applyBtn = within(section).getByRole("button", { name: actionApply }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
    expect(within(section).getByRole("button", { name: actionSimpler })).toBeTruthy();
    expect(within(section).queryByRole("button", { name: /advanced/i })).toBeNull();
  });

  it("upload-first action stays disabled until preview resolves", async () => {
    actionMocks.previewCalibrationRecommendation.mockImplementation(() => new Promise(() => {}));
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    const section = reviewSection();
    const applyBtn = within(section).getByRole("button", { name: actionApply }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
  });

  it("successful upload-first action calls complete action and router.replace to /contracts/new", async () => {
    const user = userEvent.setup();
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitForReviewPreviewRoot();
    await user.click(within(reviewSection()).getByRole("button", { name: actionApply }));
    await waitFor(() =>
      expect(actionMocks.completeQuestionnaireAcceptRecommendation).toHaveBeenCalled()
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/contracts/new"));
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
    expect(label?.className).toMatch(/min-h-1(0|1)/);
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
    actionMocks.completeQuestionnaireAcceptRecommendation.mockImplementation(() => new Promise(() => {}));
    render(
      <CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />
    );
    await waitForReviewPreviewRoot();
    const section = reviewSection();
    await user.click(within(section).getByRole("button", { name: actionSimpler }));
    await waitFor(() => {
      expect(
        (within(section).getByRole("button", { name: actionApply }) as HTMLButtonElement).disabled
      ).toBe(true);
      expect(
        (within(section).getByRole("button", { name: actionSimpler }) as HTMLButtonElement).disabled
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
    await waitForReviewPreviewRoot();
    await user.click(within(reviewSection()).getByRole("button", { name: actionApply }));
    await waitFor(() => {
      const live = container.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toContain("Server rejected apply.");
    });
  });

  it("review snapshot has no serious or critical axe wcag2a violations", async () => {
    actionMocks.previewCalibrationRecommendation.mockResolvedValue({ ok: true, recommendation: mockRec });
    render(<CalibrationWizard initialRequired={{ ...fullReq }} initialOptional={{}} initialStep={8} />);
    await waitForReviewPreviewRoot();
    await screen.findByRole("heading", { level: 1, name: reviewStepTitle });
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
    await waitForReviewPreviewRoot();
    expect(screen.getByTestId(calibrationReviewTestIds.root)).toBeTruthy();
    expect(screen.getByTestId(calibrationReviewTestIds.setup)).toBeTruthy();
    expect(screen.getByRole("heading", { name: reviewSectionHeadings.setup })).toBeTruthy();
    expect(screen.getByText(setupChecklistKeyLabels.upload_contract)).toBeTruthy();
    expect(screen.getByTestId(calibrationReviewTestIds.reports)).toBeTruthy();
    expect(screen.queryByTestId(calibrationReviewTestIds.searchScope)).toBeNull();
    expect(screen.queryByTestId(calibrationReviewTestIds.notifications)).toBeNull();
  });

  it("review hides mode and utility implementation details even when preview contains them", async () => {
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
    await waitForReviewPreviewRoot();
    expect(screen.queryByText(/Core mode|Advanced mode|Assurance mode/i)).toBeNull();
    expect(screen.queryByText(/Hidden: Intake/)).toBeNull();
    expect(screen.queryByTestId(calibrationReviewTestIds.utilities)).toBeNull();
  });
});
