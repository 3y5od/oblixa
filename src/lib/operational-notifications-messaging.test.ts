import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_MESSAGE_SURFACE_IDS,
  OPERATIONAL_USER_FACING_MESSAGE_REGISTRY,
  classifyOperationalNotificationRetry,
  evaluateOperationalNotificationEligibility,
  renderOperationalMessageFixture,
  validateOperationalUserFacingMessageRegistry,
} from "@/lib/operational-notifications-messaging";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";
import { RELEASE_STATE_EMAIL_TEMPLATE_KEYS } from "@/lib/release-state-email-templates";

describe("operational notification and messaging registry", () => {
  it("inventories email, in-app, toast, alert, error, banner, reminder, evidence, and billing messages", () => {
    const report = validateOperationalUserFacingMessageRegistry();
    expect(report).toMatchObject({ ok: true, issueCount: 0 });
    for (const surface of OPERATIONAL_MESSAGE_SURFACE_IDS) {
      expect(OPERATIONAL_USER_FACING_MESSAGE_REGISTRY.some((row) => row.surface === surface)).toBe(true);
    }
  });

  it("covers release email templates and notification taxonomy rows with owners, triggers, sensitivity, and tests", () => {
    for (const key of RELEASE_STATE_EMAIL_TEMPLATE_KEYS) {
      expect(OPERATIONAL_USER_FACING_MESSAGE_REGISTRY).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `release_email.${key}`,
            owner: expect.stringMatching(/^@/),
            trigger: key,
            source: "src/lib/release-state-email-templates.ts",
            testCoverage: "src/lib/release-state-email-templates.test.ts",
          }),
        ])
      );
    }
    for (const entry of NOTIFICATION_TAXONOMY) {
      expect(OPERATIONAL_USER_FACING_MESSAGE_REGISTRY).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `notification.${entry.notificationType}`,
            owner: "@notifications",
            trigger: entry.notificationType,
            source: "src/lib/notification-taxonomy.ts",
            testCoverage: "src/lib/notification-taxonomy.test.ts",
          }),
        ])
      );
    }
  });
});

describe("operational notification eligibility", () => {
  const base = {
    notificationType: "saved_view_summary",
    channelEnabled: true,
    orgStatus: "active" as const,
    recipientStatus: "active" as const,
    billingState: "active" as const,
    workspaceMode: "advanced" as const,
    notificationTier: "core" as const,
    rateLimitRemaining: 1,
  };

  it("does not send when preferences, org state, user state, billing state, workspace mode, duplicates, rate limits, or digest grouping block it", () => {
    const cases = [
      [{ channelEnabled: false }, "opt_out"],
      [{ blockedTypes: ["saved_view_summary"] }, "opt_out"],
      [{ orgStatus: "disabled" as const }, "disabled_org"],
      [{ recipientStatus: "inactive" as const }, "inactive_user"],
      [{ billingState: "past_due" as const }, "billing_state"],
      [{ workspaceMode: "core" as const, notificationTier: "advanced" as const }, "workspace_mode"],
      [{ duplicateKey: "digest:1", deliveredDeduplicationKeys: ["digest:1"] }, "duplicate_suppression"],
      [{ rateLimitRemaining: 0 }, "rate_limited"],
      [{ digestGrouping: { mode: "digest" as const, groupKey: "saved-view:1", pendingCount: 3 } }, "digest_grouping"],
    ];

    for (const [patch, reason] of cases) {
      const result = evaluateOperationalNotificationEligibility({ ...base, ...(patch as object) });
      expect(result.allowed).toBe(false);
      expect(result.immediateSend).toBe(false);
      expect(result.reasons).toContain(reason);
    }
  });

  it("allows active recipients when policy, billing, workspace mode, rate limits, and grouping are clear", () => {
    expect(evaluateOperationalNotificationEligibility(base)).toMatchObject({
      allowed: true,
      immediateSend: true,
      reasons: [],
    });
  });
});

describe("operational message rendering", () => {
  it("escapes HTML, strips markdown links, includes unsubscribe, handles missing fields, formats dates, and redacts secrets", () => {
    const rendered = renderOperationalMessageFixture({
      recipientDisplayName: "<script>alert(1)</script> A very long recipient name ".repeat(8),
      entityName: "Renewal packet Bearer secret-token-12345",
      actionHref: "javascript:alert(1)",
      dueAt: "2026-05-29T14:00:00Z",
      locale: "en-US",
      timeZone: "UTC",
      unsubscribeHref: "/settings/product#notifications",
      markdownBody: "Review [the packet](https://example.test/private?token=abc) before sending.",
    });

    expect(rendered.subject).not.toContain("\n");
    expect(rendered.html).not.toMatch(/<script|javascript:|Bearer secret-token-12345|token=abc/i);
    expect(rendered.html).toContain("Manage notification preferences");
    expect(rendered.html).toContain("May");
    expect(rendered.text).toContain("Review the packet before sending.");
  });
});

describe("operational notification retry and dead-letter policy", () => {
  it("covers provider, transient, permanent, duplicate, stale, and poison payload outcomes without duplicate user impact", () => {
    expect(
      classifyOperationalNotificationRetry({
        attemptCount: 0,
        maxAttempts: 3,
        errorClass: "provider_failure",
        hasRetryPayload: true,
        duplicateDelivery: false,
        stale: false,
      })
    ).toMatchObject({ outcome: "retrying", retry: true, userImpact: "none" });
    expect(
      classifyOperationalNotificationRetry({
        attemptCount: 1,
        maxAttempts: 3,
        errorClass: "transient_failure",
        hasRetryPayload: true,
        duplicateDelivery: false,
        stale: false,
      })
    ).toMatchObject({ outcome: "retrying", retry: true, userImpact: "none" });
    expect(
      classifyOperationalNotificationRetry({
        attemptCount: 0,
        maxAttempts: 3,
        errorClass: "permanent_failure",
        hasRetryPayload: true,
        duplicateDelivery: false,
        stale: false,
      })
    ).toMatchObject({ outcome: "failed_dead_letter", deadLetter: true, userImpact: "none" });
    expect(
      classifyOperationalNotificationRetry({
        attemptCount: 0,
        maxAttempts: 3,
        errorClass: "none",
        hasRetryPayload: true,
        duplicateDelivery: true,
        stale: false,
      })
    ).toMatchObject({ outcome: "suppressed_duplicate", userImpact: "none" });
    expect(
      classifyOperationalNotificationRetry({
        attemptCount: 0,
        maxAttempts: 3,
        errorClass: "none",
        hasRetryPayload: true,
        duplicateDelivery: false,
        stale: true,
      })
    ).toMatchObject({ outcome: "suppressed_stale", userImpact: "none" });
    expect(
      classifyOperationalNotificationRetry({
        attemptCount: 0,
        maxAttempts: 3,
        errorClass: "none",
        hasRetryPayload: false,
        duplicateDelivery: false,
        stale: false,
      })
    ).toMatchObject({ outcome: "failed_dead_letter", deadLetter: true, userImpact: "none" });
  });
});
