import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { V10_GA_SAMPLE_SIZES } from "./release-contract";
import { V10_GA_METRIC_EVIDENCE_REQUIREMENTS } from "./release-evidence";

describe("V10 RC metric capture path (suite fixture contract)", () => {
  it("emits denominator locks and capture commands for every GA objective metric", () => {
    const r = spawnSync("node", ["scripts/check-release-suite-current.mjs", "--fixture", "all"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const payload = JSON.parse(r.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.denominatorLocks).toMatchObject({
      activation: "v10-rc:activation:100",
      command_palette_search: "v10-rc:command_palette_search:200",
    });
    expect(payload.metricCaptureCommands.length).toBeGreaterThanOrEqual(11);

    const sampleKeys = Object.keys(V10_GA_SAMPLE_SIZES) as (keyof typeof V10_GA_SAMPLE_SIZES)[];
    for (const key of sampleKeys) {
      const n = V10_GA_SAMPLE_SIZES[key];
      expect(payload.denominatorLocks[key], key).toBe(`v10-rc:${key}:${n}`);
    }
    const metricKeys = new Set(V10_GA_METRIC_EVIDENCE_REQUIREMENTS.map((row) => row.metric_key));
    for (const key of sampleKeys) {
      expect(metricKeys.has(key), `V10_GA_METRIC_EVIDENCE_REQUIREMENTS missing ${key}`).toBe(true);
    }
  });
});
