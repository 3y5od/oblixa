import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function revalidatePathsFromFile(relPath: string): Set<string> {
  const raw = readFileSync(join(process.cwd(), relPath), "utf8");
  const out = new Set<string>();
  for (const m of raw.matchAll(/revalidatePath\(\s*["']([^"']+)["']\s*\)/g)) {
    out.add(m[1]);
  }
  return out;
}

describe("calibration vs product-surface-settings revalidatePath parity", () => {
  it("onboarding-calibration surfaces stay aligned with product settings mutations (subset equality on shared paths)", () => {
    const cal = revalidatePathsFromFile("src/actions/onboarding-calibration.ts");
    const settings = revalidatePathsFromFile("src/actions/product-surface-settings.ts");
    for (const p of cal) {
      expect(settings.has(p), `missing ${p} in product-surface-settings`).toBe(true);
    }
    expect(cal.has("/onboarding/calibration")).toBe(true);
    expect(cal.has("/settings/operations")).toBe(false);
  });
});
