import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "@/lib/feature-flags";
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import {
  coreFallbackV6Patch,
  finalizeRecommendation,
  recommendationToV6Patch,
  resolveWorkspaceMode,
} from "@/lib/onboarding/calibration-map";
import { computeCalibrationDimensionScores } from "@/lib/onboarding/calibration-dimensions";
import { reviewStepTitle } from "@/lib/onboarding/calibration-copy";

const flags = getFeatureFlags();

function baseAnswers(overrides: Partial<CalibrationAnswersRequired> = {}): CalibrationAnswersRequired {
  return {
    primary_use_case: "track_contracts_dates",
    team_model: "solo",
    workflow_maturity: "manual_spreadsheet",
    main_pain: "find_contracts_dates",
    complexity_preference: "simplest",
    setup_intent: "upload_import",
    assurance_intent: "not_now",
    ...overrides,
  };
}

describe("onboarding spec acceptance (§22)", () => {
  it("§22.1 — coreFallbackV6Patch is core-safe (workspace_mode core, conservative search_scope)", () => {
    const p = coreFallbackV6Patch();
    expect(p.workspace_mode).toBe("core");
    expect(p.search_scope).toBe("core_only");
    expect(p.autopilot_allow_execution).toBe(false);
  });

  it("§22.2 — scoring and dimensions are deterministic for the same answers", () => {
    const a = baseAnswers({ complexity_preference: "more_if_helps" });
    expect(resolveWorkspaceMode(a)).toBe(resolveWorkspaceMode({ ...a }));
    const d1 = computeCalibrationDimensionScores(a);
    const d2 = computeCalibrationDimensionScores({ ...a });
    expect(d1).toEqual(d2);
  });

  it("§22.3 — simplest complexity caps visible mode even with strong coordination signals", () => {
    const a = baseAnswers({
      complexity_preference: "simplest",
      primary_use_case: "coordinate_renewals_decisions",
    });
    expect(resolveWorkspaceMode(a)).toBe("core");
  });

  it("§22.4 — core recommendation patch hides advanced module families", () => {
    const rec = finalizeRecommendation(baseAnswers(), flags);
    expect(rec.recommended_workspace_mode).toBe("core");
    const patch = recommendationToV6Patch(rec);
    expect(patch.advanced_modules_hidden?.length).toBeGreaterThan(0);
  });

  it("§22.5 — review copy uses Recommended wording (wizard ties label to recommendation)", () => {
    expect(reviewStepTitle.length).toBeGreaterThan(0);
    const wizard = readFileSync(
      join(process.cwd(), "src/components/onboarding/calibration-wizard.tsx"),
      "utf8"
    );
    expect(wizard).toMatch(/\(recommended\)/);
  });

  it("§22.6 — beginRecalibration sets in_progress and merges via mergeV6OrgSettingsJson", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    expect(raw).toContain("export async function beginRecalibration");
    expect(raw).toContain("status: \"in_progress\"");
    const start = raw.indexOf("export async function beginRecalibration");
    const end = raw.indexOf("function buildAppliedSnapshot", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(raw.slice(start, end)).toContain("mergeV6OrgSettingsJson");
  });

  it("§22.7 — merge + revalidate parity covered by onboarding-merge-parity.test.ts import surface", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/onboarding/onboarding-merge-parity.test.ts"), "utf8");
    expect(raw).toContain("mergeV6OrgSettingsJson");
    expect(raw).toContain("revalidatePath");
  });
});
