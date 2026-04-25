import { afterEach, beforeEach, vi } from "vitest";

/** Freeze clock for stable due-soon / horizon assertions (V9 deterministic harness). */
export function installV9FrozenTime(iso: string) {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
