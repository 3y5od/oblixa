import { describe, expect, it } from "vitest";
import {
  isValidDefaultLandingPath,
  normalizeLandingPath,
  resolveEffectiveLandingPath,
} from "@/lib/product-surface/landing-eligibility";

describe("landing-eligibility", () => {
  it("normalizes query and hash", () => {
    expect(normalizeLandingPath("/work?q=1#frag")).toBe("/work");
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
});
