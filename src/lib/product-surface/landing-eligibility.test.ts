import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  isValidDefaultLandingPath,
  normalizeLandingPath,
  resolveEffectiveLandingPath,
} from "@/lib/product-surface/landing-eligibility";

describe("landing-eligibility", () => {
  it("normalizes query and hash", () => {
    expect(normalizeLandingPath("/work?q=1#frag")).toBe("/work");
  });

  it("property: normalizeLandingPath strips query/hash and trims whitespace", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (prefix, query, hash) => {
          const input = `  ${prefix}?${query}#${hash}  `;
          const out = normalizeLandingPath(input);
          expect(out.includes("?")).toBe(false);
          expect(out.includes("#")).toBe(false);
          expect(out).toBe(out.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  it("allows Core-safe paths", () => {
    expect(isValidDefaultLandingPath("/dashboard", "core")).toBe(true);
    expect(isValidDefaultLandingPath("/work", "core")).toBe(true);
    expect(isValidDefaultLandingPath("/contracts/review", "core")).toBe(true);
  });

  it("rejects §10.4 utilities as Core org default landing", () => {
    expect(isValidDefaultLandingPath("/contracts/data-quality", "core")).toBe(false);
    expect(isValidDefaultLandingPath("/contracts/maintenance", "core")).toBe(false);
  });

  it("rejects /more as default landing", () => {
    expect(isValidDefaultLandingPath("/more", "core")).toBe(false);
    expect(isValidDefaultLandingPath("/more", "advanced")).toBe(false);
  });

  it("rejects paths below workspace mode", () => {
    expect(isValidDefaultLandingPath("/decisions", "core")).toBe(false);
    expect(isValidDefaultLandingPath("/assurance", "advanced")).toBe(false);
    expect(isValidDefaultLandingPath("/decisions", "advanced")).toBe(true);
    expect(isValidDefaultLandingPath("/assurance", "assurance")).toBe(true);
  });

  it("falls back to /dashboard when raw landing is missing/invalid", () => {
    expect(resolveEffectiveLandingPath(undefined, "core")).toBe("/dashboard");
    expect(resolveEffectiveLandingPath("/decisions", "core")).toBe("/dashboard");
    expect(resolveEffectiveLandingPath("/contracts/maintenance", "core")).toBe("/dashboard");
  });

  it("keeps valid paths after normalization", () => {
    expect(resolveEffectiveLandingPath("/work?foo=1", "core")).toBe("/work");
  });

  it("rejects landing paths hidden by module configuration when eligibility context is available", () => {
    const denied = isValidDefaultLandingPath("/decisions", "advanced", {
      role: "editor",
      advancedModulesHidden: new Set(["decisions"]),
      assuranceModulesHidden: new Set(),
      utilityModulesHidden: new Set(),
      isAdmin: false,
    });
    expect(denied).toBe(false);
  });

  it("normalizes to /dashboard when eligibility context denies landing", () => {
    const resolved = resolveEffectiveLandingPath("/decisions", "advanced", {
      role: "editor",
      advancedModulesHidden: new Set(["decisions"]),
      assuranceModulesHidden: new Set(),
      utilityModulesHidden: new Set(),
      isAdmin: false,
    });
    expect(resolved).toBe("/dashboard");
  });
});
