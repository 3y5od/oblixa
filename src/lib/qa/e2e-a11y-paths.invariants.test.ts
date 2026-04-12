import { describe, expect, it } from "vitest";
import {
  AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS,
  REFINEMENT_S10_4_UTILITY_PATHS,
} from "../../../e2e/authenticated-a11y-paths";

/** Paths allowed to appear in both matrices (utility surfaces also in Tier 1/2 Axe run). */
const EXPECTED_OVERLAP = new Set([
  "/contracts/data-quality",
  "/contracts/maintenance",
  "/more",
]);

function assertPathShape(label: string, paths: readonly string[]) {
  const seen = new Set<string>();
  for (const p of paths) {
    expect(p, `${label}: empty path`).toBeTruthy();
    expect(p.startsWith("/"), `${label}: must start with /`).toBe(true);
    expect(p.includes("//"), `${label}: no //`).toBe(false);
    expect(seen.has(p), `${label}: duplicate ${p}`).toBe(false);
    seen.add(p);
  }
}

describe("e2e authenticated A11y path matrices", () => {
  it("AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS are well-formed", () => {
    assertPathShape("AUTHENTICATED", AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS);
  });

  it("REFINEMENT_S10_4_UTILITY_PATHS are well-formed", () => {
    assertPathShape("S10_4", REFINEMENT_S10_4_UTILITY_PATHS);
  });

  it("overlap between matrices matches explicit allowlist", () => {
    const a = new Set<string>(AUTHENTICATED_A11Y_AND_VIEWPORT_PATHS);
    const overlap = REFINEMENT_S10_4_UTILITY_PATHS.filter((p) => a.has(p));
    expect(new Set(overlap)).toEqual(EXPECTED_OVERLAP);
  });
});
