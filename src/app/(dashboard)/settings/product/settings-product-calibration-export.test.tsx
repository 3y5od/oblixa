/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsProductCalibrationExport } from "@/app/(dashboard)/settings/product/settings-product-calibration-export";

const exportMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<
      { ok: true; json: string } | { ok: false; error: string }
    > => ({
      ok: true,
      json: '{"export_version":1,"exported_at":"x","organization_fingerprint":"abcd1234","onboarding_calibration":{"version":2,"blocking_required":false,"status":"completed"}}',
    })
  )
);

vi.mock("@/actions/onboarding-calibration", () => ({
  exportOnboardingCalibrationSupportJson: exportMock,
}));

describe("SettingsProductCalibrationExport", () => {
  afterEach(() => {
    cleanup();
    exportMock.mockClear();
  });

  it("renders export control and calls server action on click", async () => {
    const user = userEvent.setup();
    render(<SettingsProductCalibrationExport orgFingerprint="feedface" />);

    const btn = screen.getByRole("button", { name: /Export questionnaire JSON/i });
    expect(btn.getAttribute("disabled")).toBeNull();

    await user.click(btn);
    expect(exportMock).toHaveBeenCalledTimes(1);
  });

  it("shows server error message when export fails", async () => {
    exportMock.mockResolvedValueOnce({ ok: false, error: "No calibration record." });
    const user = userEvent.setup();
    render(<SettingsProductCalibrationExport orgFingerprint="feedface" />);
    await user.click(screen.getByRole("button", { name: /Export questionnaire JSON/i }));
    expect(await screen.findByText(/No calibration record/i)).toBeTruthy();
  });
});
