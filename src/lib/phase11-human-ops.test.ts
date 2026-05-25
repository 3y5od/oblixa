import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { V10_GA_SAMPLE_SIZES } from "./release-contract";
import { getV10ObjectiveMeasurementRule } from "./objective-measurements";
import { buildV10SettingsHealthDiagnostics } from "./governance";
import { getV10AcceptanceMatrixRow } from "./acceptance-matrix";

describe("Phase 11 — human study + post-GA SLO governance (automatable contracts)", () => {
  it("locks pre-GA usability sample to 20 participants with an 18/20 promotion bar (§2.2)", () => {
    expect(V10_GA_SAMPLE_SIZES.usability_participants).toBe(20);
    const rule = getV10ObjectiveMeasurementRule("usability_participants");
    expect(rule.fixedSampleSize).toBe(20);
    expect(rule.promotionThreshold).toBe(0.9);
    expect(Math.ceil(rule.promotionThreshold * rule.fixedSampleSize)).toBe(18);
  });

  it("surfaces post-GA operational SLO misses as workspace health diagnostics (§2.2)", () => {
    const diagnostics = buildV10SettingsHealthDiagnostics({
      postGaOperationalSloMisses: [
        {
          window: "7d",
          sloKey: "post_ga_7_day_dashboard",
          observedSummary: "Activation SLO below target in the rolling 7-day window.",
        },
      ],
    });
    expect(diagnostics[0]).toMatchObject({
      key: "post_ga_operational_slo:7d:post_ga_7_day_dashboard",
      recoveryHref: "/settings/health#v10-post-ga-slo",
    });
    expect(diagnostics[0]?.userVisibleSummary).toContain("7-day");
  });

  it("keeps non-autonomous and signoff acceptance rows wired for Phase 11 evidence", () => {
    expect(getV10AcceptanceMatrixRow("non-autonomous-evidence-schema")).toMatchObject({
      blockerType: "human_study",
    });
    expect(getV10AcceptanceMatrixRow("release-signoff-governance")).toMatchObject({
      blockerType: "release_owner_signoff",
    });
  });

  it("emits structured post-GA evidence JSON from the release-evidence CLI", () => {
    const r = spawnSync("node", ["scripts/check-release-evidence.mjs", "--post-ga", "7d"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({
      mode: "post_ga_runtime_dashboard_required",
      window: "7d",
    });
  });

  it("clears external blocker review mode when no outstanding blockers are supplied", () => {
    const r = spawnSync("node", ["scripts/check-release-evidence.mjs", "--external-blockers", "none"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({
      mode: "external_blocker_review",
      ok: true,
    });
  });
});
