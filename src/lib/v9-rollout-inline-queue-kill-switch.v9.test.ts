import { afterEach, describe, expect, it } from "vitest";
import { v9InlineQueueActionsEnabled } from "./v9-rollout";

describe("V9 rollout — inline queue actions kill switch (NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS)", () => {
  const key = "NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS" as const;
  const previous = process.env[key];

  afterEach(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });

  it("defaults to enabled when the public env var is unset", () => {
    delete process.env[key];
    expect(v9InlineQueueActionsEnabled()).toBe(true);
  });

  it("disables inline queue affordances when set to 0", () => {
    process.env[key] = "0";
    expect(v9InlineQueueActionsEnabled()).toBe(false);
  });
});
