import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function listTsxRecursive(dir: string, root: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listTsxRecursive(p, root));
    else if (ent.name.endsWith(".tsx") && !ent.name.includes(".test.")) {
      out.push(relative(root, p));
    }
  }
  return out;
}

describe("onboarding QA static guards", () => {
  it("completeProductOnboarding only touches profiles.onboarding_completed_at", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/settings.ts"), "utf8");
    const idx = raw.indexOf("export async function completeProductOnboarding");
    expect(idx).toBeGreaterThan(-1);
    const slice = raw.slice(idx, idx + 800);
    expect(slice).toContain("onboarding_completed_at");
    expect(slice).not.toContain("onboarding_calibration");
    expect(slice).not.toContain("mergeOrgSettingsJson");
  });

  it("feature registry keeps /onboarding/calibration in product route prefixes", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/product-surface/feature-registry.ts"), "utf8");
    expect(raw).toContain('"/settings", "/onboarding/calibration"');
  });

  it("dashboard-data selects onboarding_completed_at for banner path", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/dashboard-data.ts"), "utf8");
    expect(raw).toContain("onboarding_completed_at");
  });

  it("onboarding-calibration applies stripPrototypePollutionKeys for every unknown payload entrypoint", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    const callSites = (raw.match(/stripPrototypePollutionKeys\(/g) ?? []).length;
    expect(callSites).toBe(4);
  });

  it("auth signUp returns redirectTo /dashboard without resolveBlockingCalibrationPath (first-hit gating via proxy / next nav)", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/auth.ts"), "utf8");
    const signUpChunk = raw.slice(raw.indexOf("export async function signUp"), raw.indexOf("export async function signIn"));
    expect(signUpChunk).toContain('redirectTo: "/dashboard"');
    expect(signUpChunk).not.toContain("resolveBlockingCalibrationPathForAdminOrg");
    expect(raw).toContain("resolveBlockingCalibrationPathForAdminOrg");
  });

  it("calibration completion still invokes applyWorkspaceProductTransitionSideEffects", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    expect(raw).toContain("applyWorkspaceProductTransitionSideEffects");
  });

  it("calibration-wizard debounces saveQuestionnaireProgress (~400ms)", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/onboarding/calibration-wizard.tsx"),
      "utf8"
    );
    expect(raw).toContain("saveQuestionnaireProgress");
    expect(raw).toMatch(/setTimeout\([\s\S]*?,\s*400\s*\)/);
  });

  it("client onboarding/settings calibration components avoid secret-like process.env (except NEXT_PUBLIC_ if any)", () => {
    const root = process.cwd();
    const files = [
      ...listTsxRecursive(join(root, "src/components/onboarding"), root),
      "src/app/(dashboard)/settings/product/settings-product-calibration-summary.tsx",
      "src/app/(dashboard)/settings/product/settings-product-calibration-export.tsx",
    ];
    const bad = /\bprocess\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]+/;
    for (const rel of files) {
      const raw = readFileSync(join(root, rel), "utf8");
      expect(raw, rel).not.toMatch(bad);
    }
  });

  it("calibration-wizard and onboarding-banner use app-relative hrefs (no unexpected http(s) links)", () => {
    for (const rel of [
      "src/components/onboarding/calibration-wizard.tsx",
      "src/components/dashboard/onboarding-banner.tsx",
    ]) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw).not.toMatch(/href=\{?["']https?:\/\//);
      expect(raw).not.toMatch(/Link[^>]+href=["']https?:\/\//);
    }
  });

  it("calibration-wizard retains a11y / motion-reduce markers", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/onboarding/calibration-wizard.tsx"),
      "utf8"
    );
    expect(raw).toContain('aria-live="polite"');
    expect(raw).toContain('aria-label="Questionnaire progress"');
    expect(raw).toContain("motion-reduce:transition-none");
    expect(raw).toContain('role="alert"');
  });

  it("dashboard-upper coexists with onboarding banner imports (blocking + parse)", () => {
    const raw = readFileSync(join(process.cwd(), "src/components/dashboard/dashboard-upper.tsx"), "utf8");
    expect(raw).toContain("parseOnboardingCalibration");
    expect(raw).toContain("isOnboardingBlockingForAdmin");
    expect(raw).toContain("OnboardingBanner");
  });
});
