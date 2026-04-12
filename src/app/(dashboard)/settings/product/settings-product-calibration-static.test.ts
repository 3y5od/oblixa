import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("settings product calibration UI markers", () => {
  it("page wires calibration summary markers for history / applied / recommendation", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/settings/product/settings-product-calibration-summary.tsx"),
      "utf8"
    );
    expect(raw).toContain("settingsCalibrationMarkers.historyDetails");
    expect(raw).toContain("settingsCalibrationMarkers.lastAppliedDetails");
    expect(raw).toContain("settingsCalibrationMarkers.lastRecommendationDetails");
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/settings/product/page.tsx"),
      "utf8"
    );
    expect(page).toContain("SettingsProductCalibrationSummary");
    expect(page).toContain("data-settings-calibration-summary");
  });
});
