import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 engineering hygiene bundle", () => {
  it("package.json lists skip governance for V9-owned skips", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["check:test-skip-governance"]).toContain("report-test-skip-governance");
  });

  it("retains Sentry scrub bridge test (PII guard)", () => {
    expect(existsSync(join(process.cwd(), "src/lib/product-surface/sentry-scrub-bridge.test.ts"))).toBe(true);
  });

  it("smoke e2e includes public marketing regression anchor", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:e2e:smoke"]).toContain("marketing-public.spec.ts");
    expect(pkg.scripts["test:e2e:smoke"]).toContain("external-public.spec.ts");
  });

  it("documents i18n deferral anchors without introducing a framework", () => {
    expect(read("src/lib/onboarding/calibration-copy.ts")).toContain("FUTURE(i18n)");
  });

  it("keeps spec-trace.test.ts on disk so trace-map renames update V9_SPEC_TRACE in the same change", () => {
    expect(existsSync(join(process.cwd(), "src/lib/spec-trace.test.ts"))).toBe(true);
  });
});
