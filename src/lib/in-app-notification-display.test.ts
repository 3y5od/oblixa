import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getInAppNotificationCtaLabel,
  getInAppNotificationTypeLabel,
  truncateInAppNotificationBody,
  V9_IN_APP_NOTIFICATION_BODY_MAX,
} from "./in-app-notification-display";

describe("truncateInAppNotificationBody (V9 §18.5)", () => {
  it("returns empty for nullish", () => {
    expect(truncateInAppNotificationBody(null)).toBe("");
    expect(truncateInAppNotificationBody(undefined)).toBe("");
  });

  it("preserves short bodies", () => {
    expect(truncateInAppNotificationBody("hello")).toBe("hello");
  });

  it("truncates long bodies with ellipsis under the max length", () => {
    const long = "a".repeat(V9_IN_APP_NOTIFICATION_BODY_MAX + 80);
    const out = truncateInAppNotificationBody(long);
    expect(out.length).toBeLessThanOrEqual(V9_IN_APP_NOTIFICATION_BODY_MAX);
    expect(out.endsWith("…")).toBe(true);
  });

  it("maps notification types to clearer labels and CTAs", () => {
    expect(getInAppNotificationTypeLabel("approval_requested")).toBe("Approval request");
    expect(getInAppNotificationTypeLabel("mention")).toBe("Comment mention");
    expect(getInAppNotificationCtaLabel("task_assigned")).toBe("Open assigned work");
    expect(getInAppNotificationTypeLabel("renewal_due")).toBe("Renewal due");
    expect(getInAppNotificationTypeLabel("exception_assigned")).toBe("Exception assignment");
    expect(getInAppNotificationTypeLabel("review_backlog")).toBe("Review backlog");
    expect(getInAppNotificationCtaLabel("obligation_due")).toBe("Open obligations");
    expect(getInAppNotificationCtaLabel("saved_view_summary")).toBe("Open saved view reports");
    expect(getInAppNotificationCtaLabel("reminder_due")).toBe("Open upcoming work");
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
