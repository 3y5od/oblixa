import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getInAppNotificationCtaLabel,
  getInAppNotificationTypeLabel,
  truncateInAppNotificationBody,
  IN_APP_NOTIFICATION_BODY_MAX,
} from "./in-app-notification-display";

describe("truncateInAppNotificationBody", () => {
  it("returns empty for nullish", () => {
    expect(truncateInAppNotificationBody(null)).toBe("");
    expect(truncateInAppNotificationBody(undefined)).toBe("");
  });

  it("preserves short bodies", () => {
    expect(truncateInAppNotificationBody("hello")).toBe("hello");
  });

  it("truncates long bodies with ellipsis under the max length", () => {
    const long = "a".repeat(IN_APP_NOTIFICATION_BODY_MAX + 80);
    const out = truncateInAppNotificationBody(long);
    expect(out.length).toBeLessThanOrEqual(IN_APP_NOTIFICATION_BODY_MAX);
    expect(out.endsWith("…")).toBe(true);
  });

  it("maps notification types to clearer labels and CTAs", () => {
    expect(getInAppNotificationTypeLabel("approval_requested")).toBe("Approval request");
    expect(getInAppNotificationTypeLabel("mention")).toBe("Comment mention");
    expect(getInAppNotificationCtaLabel("task_assigned")).toBe("Open assigned task");
    expect(getInAppNotificationTypeLabel("renewal_due")).toBe("Renewal due");
    expect(getInAppNotificationTypeLabel("exception_assigned")).toBe("Issue assignment");
    expect(getInAppNotificationTypeLabel("review_backlog")).toBe("Detail confirmation backlog");
    expect(getInAppNotificationTypeLabel("obligation_due")).toBe("Requirement due");
    expect(getInAppNotificationCtaLabel("obligation_due")).toBe("Open requirements");
    expect(getInAppNotificationCtaLabel("saved_view_summary")).toBe("Open saved view reports");
    expect(getInAppNotificationCtaLabel("reminder_due")).toBe("Open upcoming task");
  });

  it("is applied on the collaboration inbox surface", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/collaboration/page.tsx"),
      "utf8"
    );
    expect(raw).toContain("truncateInAppNotificationBody");
    expect(raw).toContain("getInAppNotificationTypeLabel");
    expect(raw).toContain("getInAppNotificationCtaLabel");
  });
});
