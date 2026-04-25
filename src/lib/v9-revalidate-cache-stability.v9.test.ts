/**
 * V9 §21.4 + Appendix Q — deterministic proxies for cache/reconciliation behavior on hot paths.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("revalidate + client refresh stability (V9 §21.4)", () => {
  it("uses throttled router.refresh on tab focus (avoids hammering the server)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/layout/refetch-on-window-focus.tsx"),
      "utf8"
    );
    expect(src).toContain("router.refresh()");
    expect(src).toContain("MIN_INTERVAL_MS");
    expect(src).toContain("visibilityState");
  });

  it("keeps nav badge loading off the blocking dashboard layout path", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(src).toContain("CommandPaletteLoader");
    expect(src).not.toContain("fetchNavBadgeCounts");
    expect(src).not.toContain("navBadgesCache");
    const api = readFileSync(join(process.cwd(), "src/app/api/workspace/nav-badges/route.ts"), "utf8");
    expect(api).toContain("fetchNavBadgeCounts");
  });

  it("keeps onboarding calibration revalidatePath aligned with product settings (subset)", () => {
    const cal = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    const settings = readFileSync(join(process.cwd(), "src/actions/product-surface-settings.ts"), "utf8");
    const calPaths = new Set<string>();
    const settingsPaths = new Set<string>();
    for (const m of cal.matchAll(/revalidatePath\(\s*["']([^"']+)["']\s*\)/g)) {
      calPaths.add(m[1]!);
    }
    for (const m of settings.matchAll(/revalidatePath\(\s*["']([^"']+)["']\s*\)/g)) {
      settingsPaths.add(m[1]!);
    }
    for (const p of calPaths) {
      expect(settingsPaths.has(p), `calibration revalidatePath ${p} missing in product-surface-settings`).toBe(true);
    }
  });
});
