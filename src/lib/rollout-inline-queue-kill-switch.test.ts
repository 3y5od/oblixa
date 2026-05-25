import { afterEach, describe, expect, it } from "vitest";
import { inlineQueueActionsEnabled, v9InlineQueueActionsEnabled } from "./rollout";

describe("V9 rollout — inline queue actions kill switch (NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS)", () => {
  const neutralKey = "NEXT_PUBLIC_INLINE_QUEUE_ACTIONS" as const;
  const legacyKey = "NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS" as const;
  const previousNeutral = process.env[neutralKey];
  const previousLegacy = process.env[legacyKey];

  afterEach(() => {
    if (previousNeutral === undefined) delete process.env[neutralKey];
    else process.env[neutralKey] = previousNeutral;
    if (previousLegacy === undefined) delete process.env[legacyKey];
    else process.env[legacyKey] = previousLegacy;
  });

  it("defaults to enabled when the public env var is unset", () => {
    delete process.env[neutralKey];
    delete process.env[legacyKey];
    expect(inlineQueueActionsEnabled()).toBe(true);
  });

  it("disables inline queue affordances when the neutral key is set to 0", () => {
    process.env[neutralKey] = "0";
    process.env[legacyKey] = "1";
    expect(inlineQueueActionsEnabled()).toBe(false);
  });

  it("retains the legacy key as a fallback", () => {
    process.env[legacyKey] = "0";
    expect(v9InlineQueueActionsEnabled()).toBe(false);
  });
});
