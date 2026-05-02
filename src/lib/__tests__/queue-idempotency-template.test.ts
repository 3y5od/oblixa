import { describe, expect, it } from "vitest";

/** Idempotent consumer: at-least-once delivery safe apply (Phase 69). */
export function applyIdempotentMessage<T>(store: Map<string, T>, id: string, build: () => T): T {
  if (store.has(id)) return store.get(id)!;
  const v = build();
  store.set(id, v);
  return v;
}

describe("queue consumer idempotency template", () => {
  it("dedupes by message id", () => {
    const m = new Map<string, number>();
    expect(applyIdempotentMessage(m, "a", () => 1)).toBe(1);
    expect(applyIdempotentMessage(m, "a", () => 99)).toBe(1);
  });
});
