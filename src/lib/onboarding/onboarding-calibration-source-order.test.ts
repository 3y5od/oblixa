import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = join(process.cwd(), "src/actions/onboarding-calibration.ts");

describe("onboarding-calibration accept path ordering (org JSON before transition side effects)", () => {
  it("completeQuestionnaireAcceptRecommendation merges org JSON, then applies transition, then safe suppress wrapper", () => {
    const raw = readFileSync(FILE, "utf8");
    const start = raw.indexOf("export async function completeQuestionnaireAcceptRecommendation");
    const end = raw.indexOf("export async function completeQuestionnaireSimplerSetup", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = raw.slice(start, end);
    const mergeIdxs = [...body.matchAll(/await mergeV6OrgSettingsJson/g)].map((m) => m.index!);
    expect(mergeIdxs.length).toBeGreaterThanOrEqual(2);
    const applyIdx = body.indexOf("await applyWorkspaceProductTransitionSideEffects");
    const safeSuppressIdx = body.indexOf("await safeSuppressNotificationTypesForModeDowngradeCalibration");
    expect(applyIdx).toBeGreaterThan(-1);
    expect(safeSuppressIdx).toBeGreaterThan(applyIdx);
    expect(mergeIdxs[0]!).toBeLessThan(applyIdx);
    expect(mergeIdxs[1]!).toBeLessThan(applyIdx);
  });

  it("completeMinimalPath delegates to applyBlockingCalibrationMinimalSkip (shared merge → transition → safe suppress order)", () => {
    const raw = readFileSync(FILE, "utf8");
    const start = raw.indexOf("async function completeMinimalPath");
    const end = raw.indexOf("export async function completeQuestionnaireOpenAdvancedSettings", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = raw.slice(start, end);
    expect(body).toContain("applyBlockingCalibrationMinimalSkip");
    const helperPath = join(process.cwd(), "src/lib/onboarding/calibration-blocking-minimal.ts");
    const h = readFileSync(helperPath, "utf8");
    const hs = h.indexOf("export async function applyBlockingCalibrationMinimalSkip");
    const he = h.indexOf("return { ok: true };", hs);
    expect(hs).toBeGreaterThan(-1);
    expect(he).toBeGreaterThan(hs);
    const hb = h.slice(hs, he);
    const mergeIdx = hb.indexOf("await mergeV6OrgSettingsJson");
    const applyIdx = hb.indexOf("await applyWorkspaceProductTransitionSideEffects");
    const safeIdx = hb.indexOf("await safeSuppressNotificationTypesForModeDowngradeCalibration");
    expect(mergeIdx).toBeGreaterThan(-1);
    expect(applyIdx).toBeGreaterThan(mergeIdx);
    expect(safeIdx).toBeGreaterThan(applyIdx);
  });
});
