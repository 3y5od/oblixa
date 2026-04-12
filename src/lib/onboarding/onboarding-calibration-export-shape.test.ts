import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ONBOARDING_CALIBRATION_JSON_VERSION } from "@/lib/onboarding/calibration-types";

const supportExportSchema = z
  .object({
    export_version: z.literal(1),
    exported_at: z.string(),
    organization_fingerprint: z.string().min(4).max(16),
    onboarding_calibration: z.object({
      version: z.number(),
      blocking_required: z.boolean(),
      status: z.string(),
    }),
  })
  .strict();

describe("onboarding calibration support export JSON shape (zod)", () => {
  it("parses a representative redacted envelope and matches calibration version constant", () => {
    const fixture = JSON.stringify({
      export_version: 1,
      exported_at: "2026-01-01T00:00:00.000Z",
      organization_fingerprint: "a1b2c3d4",
      onboarding_calibration: {
        version: ONBOARDING_CALIBRATION_JSON_VERSION,
        blocking_required: false,
        status: "completed",
      },
    });
    const parsed = supportExportSchema.parse(JSON.parse(fixture));
    expect(parsed.onboarding_calibration.version).toBe(ONBOARDING_CALIBRATION_JSON_VERSION);
    expect(parsed).not.toHaveProperty("service_role");
    expect(parsed).not.toHaveProperty("CRON_SECRET");
  });
});
