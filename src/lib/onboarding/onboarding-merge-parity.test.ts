import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ONBOARDING_ACTION = join(ROOT, "src/actions/onboarding-calibration.ts");
const PRODUCT_SETTINGS_ACTION = join(ROOT, "src/actions/product-surface-settings.ts");

function revalidatePathsFromSource(source: string): Set<string> {
  const out = new Set<string>();
  const re = /revalidatePath\("([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]!);
  }
  return out;
}

describe("onboarding merge + revalidate parity with product settings", () => {
  it("both actions use mergeV6OrgSettingsJson for org JSON writes", () => {
    const ob = readFileSync(ONBOARDING_ACTION, "utf8");
    const ps = readFileSync(PRODUCT_SETTINGS_ACTION, "utf8");
    expect(ob).toContain("mergeV6OrgSettingsJson");
    expect(ps).toContain("mergeV6OrgSettingsJson");
  });

  it("revalidatePath targets from onboarding-calibration are a subset of product-surface-settings union", () => {
    const ob = readFileSync(ONBOARDING_ACTION, "utf8");
    const ps = readFileSync(PRODUCT_SETTINGS_ACTION, "utf8");
    const obPaths = revalidatePathsFromSource(ob);
    const psPaths = revalidatePathsFromSource(ps);
    for (const p of obPaths) {
      expect(psPaths.has(p), `onboarding revalidates ${p} but product-settings does not`).toBe(true);
    }
  });
});
