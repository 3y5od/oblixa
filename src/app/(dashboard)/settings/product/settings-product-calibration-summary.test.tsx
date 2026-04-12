/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsProductCalibrationSummary } from "@/app/(dashboard)/settings/product/settings-product-calibration-summary";
import { settingsCalibrationMarkers } from "@/lib/onboarding/calibration-copy";
import type { OnboardingCalibrationState } from "@/lib/onboarding/calibration-types";

const baseCal: OnboardingCalibrationState = {
  version: 2,
  blocking_required: false,
  status: "completed",
};

describe("SettingsProductCalibrationSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders without history details when history is empty", () => {
    render(<SettingsProductCalibrationSummary cal={baseCal} />);
    expect(screen.queryByTestId(settingsCalibrationMarkers.historyDetails)).toBeNull();
  });

  it("shows last applied details when last_applied is present", () => {
    const cal: OnboardingCalibrationState = {
      ...baseCal,
      last_applied: {
        applied_at: "2026-01-02T00:00:00.000Z",
        applied_by_user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        applied_workspace_mode: "core",
        advanced_modules_hidden: ["decisions"],
        assurance_modules_hidden: ["findings"],
        home_hidden_sections: [],
        search_scope: "core_only",
        default_landing_path: "/dashboard",
      },
    };
    render(<SettingsProductCalibrationSummary cal={cal} />);
    expect(screen.getByTestId(settingsCalibrationMarkers.lastAppliedDetails)).toBeTruthy();
    expect(screen.getByText(/Last applied configuration/i)).toBeTruthy();
  });
});
