import { describe, expect, it } from "vitest";
import {
  isPublicAuthSurfacePath,
  unauthenticatedAccessAllowed,
} from "@/lib/auth/proxy-path-policy";

describe("proxy-path-policy", () => {
  it("treats /api as anonymous-accessible (handler-level auth)", () => {
    expect(unauthenticatedAccessAllowed("/api/anything")).toBe(true);
  });

  it("allows marketing root and legal pages without a session", () => {
    expect(unauthenticatedAccessAllowed("/")).toBe(true);
    expect(unauthenticatedAccessAllowed("/privacy")).toBe(true);
  });

  it("allows metadata image routes for crawlers", () => {
    expect(unauthenticatedAccessAllowed("/opengraph-image")).toBe(true);
    expect(unauthenticatedAccessAllowed("/icon")).toBe(true);
  });

  it("allows external participant subpaths but not bare /external", () => {
    expect(unauthenticatedAccessAllowed("/external/token-here")).toBe(true);
    expect(unauthenticatedAccessAllowed("/external")).toBe(false);
  });

  it("requires login for typical dashboard paths", () => {
    expect(unauthenticatedAccessAllowed("/dashboard")).toBe(false);
    expect(unauthenticatedAccessAllowed("/contracts")).toBe(false);
    expect(unauthenticatedAccessAllowed("/onboarding/calibration")).toBe(false);
  });

  it("identifies public auth surfaces", () => {
    expect(isPublicAuthSurfacePath("/login")).toBe(true);
    expect(isPublicAuthSurfacePath("/dashboard")).toBe(false);
  });
});
