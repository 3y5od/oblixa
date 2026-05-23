import { describe, expect, it } from "vitest";
import {
  formatTrialEnd,
  subscriptionStatusBadge,
} from "@/lib/billing/status";

// SPEC: docs/billing-page-maximal-pass.md §14.2 unit test
// subscriptionStatusBadge across all 8 Stripe states + modifiers.
describe("subscriptionStatusBadge", () => {
  it("returns healthy for active", () => {
    const badge = subscriptionStatusBadge({ status: "active" });
    expect(badge.label).toBe("Active");
    expect(badge.tone).toBe("healthy");
  });

  it("returns info for trialing", () => {
    const badge = subscriptionStatusBadge({ status: "trialing" });
    expect(badge.label).toBe("Trial");
    expect(badge.tone).toBe("info");
  });

  it("returns warning for past_due", () => {
    const badge = subscriptionStatusBadge({ status: "past_due" });
    expect(badge.label).toBe("Past due");
    expect(badge.tone).toBe("warning");
  });

  it("returns warning for incomplete", () => {
    const badge = subscriptionStatusBadge({ status: "incomplete" });
    expect(badge.label).toBe("Incomplete");
    expect(badge.tone).toBe("warning");
  });

  it("returns critical for incomplete_expired", () => {
    const badge = subscriptionStatusBadge({ status: "incomplete_expired" });
    expect(badge.label).toBe("Subscription expired");
    expect(badge.tone).toBe("critical");
  });

  it("returns critical for unpaid", () => {
    const badge = subscriptionStatusBadge({ status: "unpaid" });
    expect(badge.label).toBe("Unpaid");
    expect(badge.tone).toBe("critical");
  });

  it("returns critical for canceled", () => {
    const badge = subscriptionStatusBadge({ status: "canceled" });
    expect(badge.label).toBe("Canceled");
    expect(badge.tone).toBe("critical");
  });

  // Finishing-pass §1.9 + §1.12 — Free is the baseline zero-state per
  // spec §2.11, not info-tone. Reverted from polish-pass §8.1.
  it("returns empty 'Free plan' for none (canonical zero-state tone)", () => {
    const badge = subscriptionStatusBadge({ status: "none" });
    expect(badge.label).toBe("Free plan");
    expect(badge.tone).toBe("empty");
  });

  // SPEC: §6.4 cancel_at_period_end overrides active
  it("returns warning 'Active (cancels …)' for cancel_at_period_end", () => {
    const badge = subscriptionStatusBadge({
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: 1_700_000_000,
    });
    expect(badge.label).toMatch(/^Active \(cancels /);
    expect(badge.tone).toBe("warning");
  });

  // SPEC: §6.5 pause_collection overrides status
  it("returns info 'Paused' for pause_collection", () => {
    const badge = subscriptionStatusBadge({
      status: "active",
      pauseCollection: { resumes_at: null },
    });
    expect(badge.label).toBe("Paused");
    expect(badge.tone).toBe("info");
  });

  // SPEC: §1.30 cancel_at future-date scheduled cancellation
  it("returns warning 'Cancels …' for scheduled cancel_at", () => {
    const badge = subscriptionStatusBadge({
      status: "active",
      cancelAt: 1_800_000_000,
      currentPeriodEnd: 1_700_000_000,
    });
    expect(badge.label).toMatch(/^Cancels /);
    expect(badge.tone).toBe("warning");
  });

  it("each branch has a non-empty srLabel", () => {
    const allStatuses: Array<{ status: string; modifiers?: object }> = [
      { status: "active" },
      { status: "trialing" },
      { status: "past_due" },
      { status: "incomplete" },
      { status: "incomplete_expired" },
      { status: "unpaid" },
      { status: "canceled" },
      { status: "none" },
    ];
    for (const variant of allStatuses) {
      const badge = subscriptionStatusBadge(variant);
      expect(badge.srLabel, `srLabel missing for ${variant.status}`).toBeTruthy();
    }
  });
});

describe("formatTrialEnd", () => {
  const now = Math.floor(Date.now() / 1000);

  it("returns 'Ended' for expired trial", () => {
    expect(formatTrialEnd(now - 60)).toBe("Ended");
  });

  it("returns 'Ends in N minutes' under 1 hour", () => {
    const trialEnd = now + 30 * 60; // 30 minutes
    expect(formatTrialEnd(trialEnd)).toMatch(/^Ends in \d+ minutes?$/);
  });

  it("returns 'Ends today' under 1 day", () => {
    const trialEnd = now + 3 * 60 * 60; // 3 hours
    expect(formatTrialEnd(trialEnd)).toBe("Ends today");
  });

  it("returns 'Ends in N days' for multi-day", () => {
    const trialEnd = now + 7 * 24 * 60 * 60; // 7 days
    expect(formatTrialEnd(trialEnd)).toMatch(/^Ends in \d+ days?$/);
  });

  it("handles singular day correctly", () => {
    const trialEnd = now + 24 * 60 * 60 + 60; // 1d + 1min
    expect(formatTrialEnd(trialEnd)).toMatch(/^Ends in \d+ days?$/);
  });
});
