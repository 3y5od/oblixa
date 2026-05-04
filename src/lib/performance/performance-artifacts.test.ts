import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const semgrepPerf = path.join(process.cwd(), "semgrep", "oblixa-performance.yml");

describe("semgrep oblixa-performance.yml drift guard", () => {
  it("keeps performance rules pack non-empty", () => {
    const raw = fs.readFileSync(semgrepPerf, "utf8");
    expect(raw).toContain("rules:");
    expect(raw).toContain("oblixa-perf-supabase-select-star");
    expect(raw).toContain("oblixa-perf-supabase-large-limit");
  });
});

const qaLoadingChecklistPath = path.join(
  process.cwd(),
  "scripts",
  "qa-loading-routes-checklist.txt"
);
const releasePreflightPath = path.join(process.cwd(), "scripts", "release-preflight.mjs");

describe("performance checklist and release gate anchors", () => {
  it("keeps qa-loading-routes-checklist and release-preflight wired for perf gates", () => {
    expect(fs.existsSync(qaLoadingChecklistPath)).toBe(true);
    const checklist = fs.readFileSync(qaLoadingChecklistPath, "utf8");
    expect(checklist).toContain("src/app/(dashboard)/dashboard/loading.tsx");
    expect(checklist).toContain("src/app/(dashboard)/decisions/loading.tsx");
    expect(checklist).toContain("src/app/(dashboard)/assurance/loading.tsx");
    expect(checklist).toContain("src/app/(auth)/loading.tsx");
    expect(checklist).toContain("src/app/(dashboard)/reports/loading.tsx");

    expect(fs.existsSync(releasePreflightPath)).toBe(true);
    const preflight = fs.readFileSync(releasePreflightPath, "utf8");
    expect(preflight).toContain("check:performance-static:strict");
  });
});
