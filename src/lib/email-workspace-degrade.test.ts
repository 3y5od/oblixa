import { describe, expect, it } from "vitest";
import {
  degradeOutboundEmailCopyForCore,
  emailCopyUsesCoreSurface,
} from "@/lib/email-workspace-degrade";

describe("email-workspace-degrade (refinement §18)", () => {
  it("treats unset or core mode as Core email surface", () => {
    expect(emailCopyUsesCoreSurface(undefined)).toBe(true);
    expect(emailCopyUsesCoreSurface("core")).toBe(true);
    expect(emailCopyUsesCoreSurface("advanced")).toBe(false);
    expect(emailCopyUsesCoreSurface("assurance")).toBe(false);
  });

  it("replaces assurance-module phrases with neutral execution language", () => {
    expect(degradeOutboundEmailCopyForCore("Weekly scorecard digest")).toContain("summary");
    expect(degradeOutboundEmailCopyForCore("playbook run")).toContain("response pack");
    expect(degradeOutboundEmailCopyForCore("autopilot rules")).toContain("automation");
  });
});
