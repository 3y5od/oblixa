import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/security/redirect";

describe("getSafeRedirectPath", () => {
  it("rejects protocol-relative paths (open redirect)", () => {
    expect(getSafeRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("rejects absolute URLs and encoded slashes", () => {
    expect(getSafeRedirectPath("https://evil.example/")).toBe("/dashboard");
    expect(getSafeRedirectPath("/\\evil")).toBe("/dashboard");
  });

  it("rejects javascript: and CRLF injection attempts", () => {
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(getSafeRedirectPath("/ok\r\nLocation: evil")).toBe("/dashboard");
  });

  it("allows same-origin relative paths", () => {
    expect(getSafeRedirectPath("/contracts")).toBe("/contracts");
    expect(getSafeRedirectPath("/settings/profile")).toBe("/settings/profile");
  });

  it("returns fallback for empty, null, or overlong input", () => {
    expect(getSafeRedirectPath(null)).toBe("/dashboard");
    expect(getSafeRedirectPath("   ")).toBe("/dashboard");
    expect(getSafeRedirectPath("/x".repeat(600))).toBe("/dashboard");
  });
});
