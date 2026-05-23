import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __clearCronSingleFlightMemoryLocksForTests,
  acquireCronSingleFlightLock,
  buildCronSingleFlightLockKey,
  releaseCronSingleFlightLock,
} from "./single-flight-lock";

describe("cron single-flight lock", () => {
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __clearCronSingleFlightMemoryLocksForTests();
  });

  afterEach(() => {
    if (originalUpstashUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    if (originalUpstashToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
    __clearCronSingleFlightMemoryLocksForTests();
  });

  it("builds stable route-scoped keys", () => {
    expect(buildCronSingleFlightLockKey("/api//cron/demo")).toBe("oblixa:cron:single-flight:/api/cron/demo");
  });

  it("blocks a second acquire until the owner releases", async () => {
    const first = await acquireCronSingleFlightLock({
      key: "oblixa:cron:single-flight:test",
      ttlMs: 10_000,
      nowMs: 1_000,
      token: "first",
    });
    expect(first.acquired).toBe(true);

    const second = await acquireCronSingleFlightLock({
      key: "oblixa:cron:single-flight:test",
      ttlMs: 10_000,
      nowMs: 2_000,
      token: "second",
    });
    expect(second).toMatchObject({ acquired: false, backend: "memory", retryAfterMs: 9_000 });

    if (first.acquired) await releaseCronSingleFlightLock(first.lock);

    const third = await acquireCronSingleFlightLock({
      key: "oblixa:cron:single-flight:test",
      ttlMs: 10_000,
      nowMs: 3_000,
      token: "third",
    });
    expect(third.acquired).toBe(true);
  });

  it("lets expired in-memory locks be reclaimed", async () => {
    await acquireCronSingleFlightLock({
      key: "oblixa:cron:single-flight:expires",
      ttlMs: 1_000,
      nowMs: 1_000,
      token: "first",
    });

    const reclaimed = await acquireCronSingleFlightLock({
      key: "oblixa:cron:single-flight:expires",
      ttlMs: 1_000,
      nowMs: 2_001,
      token: "second",
    });

    expect(reclaimed).toMatchObject({ acquired: true });
  });
});
