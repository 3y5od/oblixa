import { describe, expect, it } from "vitest";
import {
  GENERATED_AUTHENTICATED_CORE_A11Y_PATHS,
  GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS,
} from "@/lib/qa/generated-route-matrices";

/** Generated matrices intentionally keep core and utility A11y slices disjoint. */
const EXPECTED_OVERLAP = new Set<string>();

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
    assertPathShape("AUTHENTICATED", GENERATED_AUTHENTICATED_CORE_A11Y_PATHS);
  });

  it("REFINEMENT_S10_4_UTILITY_PATHS are well-formed", () => {
    assertPathShape("S10_4", GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS);
  });

  it("overlap between matrices matches explicit allowlist", () => {
    const a = new Set<string>(GENERATED_AUTHENTICATED_CORE_A11Y_PATHS);
    const overlap = GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS.filter((p) => a.has(p));
    expect(new Set(overlap)).toEqual(EXPECTED_OVERLAP);
  });
});
