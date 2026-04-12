import { describe, expect, it } from "vitest";
import { resolveDestinationWithBlockingCalibration } from "@/lib/auth/post-auth-redirect";

describe("resolveDestinationWithBlockingCalibration", () => {
  it("returns post-auth destination when calibration path is null", () => {
    expect(resolveDestinationWithBlockingCalibration("/dashboard", null)).toBe("/dashboard");
  });

  it("returns post-auth destination when calibration path is undefined", () => {
    expect(resolveDestinationWithBlockingCalibration("/contracts", undefined)).toBe("/contracts");
  });

  it("returns calibration path when set, overriding dashboard", () => {
    expect(resolveDestinationWithBlockingCalibration("/dashboard", "/onboarding/calibration")).toBe(
      "/onboarding/calibration"
    );
  });

  it("returns calibration path when set, overriding a safe next path", () => {
    expect(
      resolveDestinationWithBlockingCalibration("/settings/product", "/onboarding/calibration")
    ).toBe("/onboarding/calibration");
  });
});
