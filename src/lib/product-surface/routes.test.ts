import { describe, expect, it } from "vitest";
import { isPathAllowedForWorkspaceMode } from "@/lib/product-surface/routes";

describe("isPathAllowedForWorkspaceMode", () => {
  it("allows core routes in core mode", () => {
    expect(isPathAllowedForWorkspaceMode("/dashboard", "core")).toBe(true);
    expect(isPathAllowedForWorkspaceMode("/contracts/review", "core")).toBe(true);
    expect(isPathAllowedForWorkspaceMode("/contracts/evidence-studio", "core")).toBe(true);
  });

  it("blocks advanced paths in core mode", () => {
    expect(isPathAllowedForWorkspaceMode("/decisions", "core")).toBe(false);
    expect(isPathAllowedForWorkspaceMode("/campaigns", "core")).toBe(false);
    expect(isPathAllowedForWorkspaceMode("/contracts/programs", "core")).toBe(false);
  });

  it("allows advanced paths in advanced mode", () => {
    expect(isPathAllowedForWorkspaceMode("/decisions", "advanced")).toBe(true);
  });

  it("blocks assurance paths outside assurance mode", () => {
    expect(isPathAllowedForWorkspaceMode("/assurance/findings", "core")).toBe(false);
    expect(isPathAllowedForWorkspaceMode("/assurance/findings", "advanced")).toBe(false);
    expect(isPathAllowedForWorkspaceMode("/assurance/findings", "assurance")).toBe(true);
  });
});
