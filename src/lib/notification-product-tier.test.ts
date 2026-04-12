import { describe, expect, it } from "vitest";
import {
  notificationTypesBlockedByMode,
  notificationTierForType,
  workspaceModeAllowsNotificationTier,
} from "@/lib/notification-product-tier";

describe("notification-product-tier (refinement §18.1–18.3)", () => {
  it("classifies core operational types as core tier", () => {
    expect(notificationTierForType("reminder_due")).toBe("core");
    expect(notificationTierForType("saved_view_summary")).toBe("core");
    expect(notificationTierForType("mention")).toBe("core");
  });

  it("classifies decision/campaign types as advanced tier", () => {
    expect(notificationTierForType("decision_assignment")).toBe("advanced");
    expect(notificationTierForType("campaign_status_change")).toBe("advanced");
    expect(notificationTierForType("campaign_digest")).toBe("advanced");
  });

  it("classifies assurance lemmas as assurance tier", () => {
    expect(notificationTierForType("finding_opened")).toBe("assurance");
    expect(notificationTierForType("scorecard_drop")).toBe("assurance");
    expect(notificationTierForType("autopilot_action_completed")).toBe("assurance");
    expect(notificationTierForType("review_board_packet")).toBe("assurance");
  });

  it("workspaceModeAllowsNotificationTier enforces mode ≥ tier", () => {
    expect(workspaceModeAllowsNotificationTier("core", "core")).toBe(true);
    expect(workspaceModeAllowsNotificationTier("core", "advanced")).toBe(false);
    expect(workspaceModeAllowsNotificationTier("advanced", "advanced")).toBe(true);
    expect(workspaceModeAllowsNotificationTier("advanced", "assurance")).toBe(false);
    expect(workspaceModeAllowsNotificationTier("assurance", "assurance")).toBe(true);
  });

  it("returns suppression types for mode downgrade cleanup", () => {
    expect(notificationTypesBlockedByMode("core")).toContain("decision_assignment");
    expect(notificationTypesBlockedByMode("core")).toContain("finding_opened");
    expect(notificationTypesBlockedByMode("advanced")).toContain("finding_opened");
    expect(notificationTypesBlockedByMode("advanced")).not.toContain("decision_assignment");
  });
});
