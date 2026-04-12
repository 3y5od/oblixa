import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ONBOARDING_SPEC_IMPLEMENTATION_TRACE } from "@/lib/onboarding/calibration-trace";

describe("ONBOARDING_SPEC_IMPLEMENTATION_TRACE paths exist", () => {
  const root = process.cwd();

  it("resolves every listed file from repo root", () => {
    for (const paths of Object.values(ONBOARDING_SPEC_IMPLEMENTATION_TRACE)) {
      for (const rel of paths) {
        const clean = rel.replace(/\s+\(.*\)\s*$/, "").trim();
        const full = join(root, clean);
        expect(existsSync(full), clean).toBe(true);
      }
    }
  });
});
