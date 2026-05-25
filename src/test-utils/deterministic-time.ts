import { afterEach, beforeEach, vi } from "vitest";

/** Freeze clock for stable due-soon / horizon assertions. */
export function installFrozenTime(iso: string) {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** @deprecated Compatibility alias for legacy local tests. */
export const installV9FrozenTime = installFrozenTime;
