import { describe, expect, it } from "vitest";
import { formatRelativeSampleAge } from "./v9-data-freshness";
import { fieldReviewProvenanceLabel } from "./v9-field-provenance";
import { V9_DUE_SOON_DAYS, parseBusinessDateAtNoon } from "./v9-business-dates";
import { compareUuidAsc } from "./v9-stable-order";
import { V9_JOB_LIFECYCLE } from "./v9-job-lifecycle-copy";
import { interpretHttpMutationFailure } from "./v9-api-client-errors";
import { V9_REMINDER_DELIVERY_HEALTH_HREF, reminderSuppressionDiagnosticsHint } from "./v9-notification-diagnostics";
import { v9InlineQueueActionsEnabled } from "./v9-rollout";
import { v9DisplayOrUnknown } from "./v9-sparse-records";
import { v9OutcomeLabel } from "./v9-outcome-semantics";
import { installV9FrozenTime } from "@/test-utils/v9-deterministic-time";

describe("V9 cross-cutting hardening contracts", () => {
  installV9FrozenTime("2026-04-17T15:00:00.000Z");

  it("formats extraction / reliability sample ages deterministically", () => {
    const line = formatRelativeSampleAge("2026-04-17T14:00:00.000Z");
    expect(line).toContain("Sample as of");
  });

  it("surfaces field provenance without overstating trust", () => {
    expect(fieldReviewProvenanceLabel({ status: "pending" })).toMatch(/not approved/i);
    expect(fieldReviewProvenanceLabel({ status: "approved", confidence: 82 })).toMatch(/82%/);
  });

  it("uses shared business-date noon parsing and due-soon constant", () => {
    const d = parseBusinessDateAtNoon("2026-05-01");
    expect(d && !Number.isNaN(d.getTime())).toBe(true);
    expect(V9_DUE_SOON_DAYS).toBe(14);
  });

  it("stable-sorts equal-priority ids lexicographically", () => {
    expect(compareUuidAsc("b", "a")).toBeGreaterThan(0);
    expect(compareUuidAsc("a", "a")).toBe(0);
  });

  it("documents job lifecycle vocabulary", () => {
    expect(V9_JOB_LIFECYCLE.cancel).toMatch(/Cancel/);
    expect(V9_JOB_LIFECYCLE.supersede).toMatch(/Superseded/);
  });

  it("classifies capacity / rate-limit failures for UI", () => {
    const rl = interpretHttpMutationFailure({ status: 429 });
    expect(rl.kind).toBe("rate_limited");
    expect(rl.retryAppropriate).toBe(true);
    const big = interpretHttpMutationFailure({ status: 413 });
    expect(big.kind).toBe("payload_too_large");
  });

  it("links reminder suppression diagnostics to Health", () => {
    expect(V9_REMINDER_DELIVERY_HEALTH_HREF).toBe("/settings/health");
    expect(reminderSuppressionDiagnosticsHint()).toMatch(/Health/);
  });

  it("keeps rollout toggles default-on", () => {
    expect(typeof v9InlineQueueActionsEnabled()).toBe("boolean");
  });

  it("labels sparse legacy values explicitly", () => {
    expect(v9DisplayOrUnknown(null)).toBe("Unknown");
    expect(v9OutcomeLabel("partial")).toBe("Partial");
  });

});
