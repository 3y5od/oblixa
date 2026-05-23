import { Redis } from "@upstash/redis";

const DEFAULT_SINGLE_FLIGHT_TTL_MS = 15 * 60_000;
const MIN_SINGLE_FLIGHT_TTL_MS = 1_000;
const MAX_SINGLE_FLIGHT_TTL_MS = 60 * 60_000;
const RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

type LockBackend = "upstash" | "memory";

export type CronSingleFlightLock = {
  key: string;
  token: string;
  backend: LockBackend;
  acquiredAtMs: number;
  expiresAtMs: number;
  ttlMs: number;
};

export type CronSingleFlightAcquireResult =
  | { acquired: true; lock: CronSingleFlightLock }
  | {
      acquired: false;
      key: string;
      backend: LockBackend;
      retryAfterMs: number;
      expiresAtMs: number;
    };

type MemoryLock = {
  token: string;
  expiresAtMs: number;
};

let redisClient: Redis | null | undefined;
const memoryLocks = new Map<string, MemoryLock>();

function getRedisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (redisClient === undefined) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

function clampTtlMs(ttlMs: number | undefined): number {
  if (ttlMs === undefined || !Number.isFinite(ttlMs)) return DEFAULT_SINGLE_FLIGHT_TTL_MS;
  return Math.min(MAX_SINGLE_FLIGHT_TTL_MS, Math.max(MIN_SINGLE_FLIGHT_TTL_MS, Math.floor(ttlMs)));
}

function createLockToken(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) return randomUUID();
  return `${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function pruneExpiredMemoryLocks(nowMs: number) {
  for (const [key, lock] of memoryLocks.entries()) {
    if (lock.expiresAtMs <= nowMs) memoryLocks.delete(key);
  }
}

function acquireMemoryLock(input: {
  key: string;
  token: string;
  ttlMs: number;
  nowMs: number;
}): CronSingleFlightAcquireResult {
  pruneExpiredMemoryLocks(input.nowMs);
  const existing = memoryLocks.get(input.key);
  if (existing && existing.expiresAtMs > input.nowMs) {
    return {
      acquired: false,
      key: input.key,
      backend: "memory",
      retryAfterMs: Math.max(0, existing.expiresAtMs - input.nowMs),
      expiresAtMs: existing.expiresAtMs,
    };
  }

  const expiresAtMs = input.nowMs + input.ttlMs;
  memoryLocks.set(input.key, { token: input.token, expiresAtMs });
  return {
    acquired: true,
    lock: {
      key: input.key,
      token: input.token,
      backend: "memory",
      acquiredAtMs: input.nowMs,
      expiresAtMs,
      ttlMs: input.ttlMs,
    },
  };
}

function releaseMemoryLock(lock: CronSingleFlightLock, nowMs = Date.now()) {
  pruneExpiredMemoryLocks(nowMs);
  const existing = memoryLocks.get(lock.key);
  if (existing?.token === lock.token) {
    memoryLocks.delete(lock.key);
  }
}

export function buildCronSingleFlightLockKey(route: string): string {
  const normalizedRoute = route.trim().replace(/\/{2,}/g, "/");
  return `oblixa:cron:single-flight:${normalizedRoute}`;
}

export async function acquireCronSingleFlightLock(input: {
  key: string;
  ttlMs?: number;
  nowMs?: number;
  token?: string;
}): Promise<CronSingleFlightAcquireResult> {
  const key = input.key.trim();
  const ttlMs = clampTtlMs(input.ttlMs);
  const nowMs = input.nowMs ?? Date.now();
  const token = input.token ?? createLockToken();
  const redis = getRedisClient();

  if (redis) {
    try {
      const acquired = await redis.set(key, token, { nx: true, px: ttlMs });
      if (acquired === "OK") {
        return {
          acquired: true,
          lock: {
            key,
            token,
            backend: "upstash",
            acquiredAtMs: nowMs,
            expiresAtMs: nowMs + ttlMs,
            ttlMs,
          },
        };
      }
      return {
        acquired: false,
        key,
        backend: "upstash",
        retryAfterMs: ttlMs,
        expiresAtMs: nowMs + ttlMs,
      };
    } catch (error) {
      console.error("[cron-single-flight] Upstash lock acquire failed; falling back to in-process lock", error);
    }
  }

  return acquireMemoryLock({ key, token, ttlMs, nowMs });
}

export async function releaseCronSingleFlightLock(lock: CronSingleFlightLock): Promise<void> {
  if (lock.backend === "memory") {
    releaseMemoryLock(lock);
    return;
  }

  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.eval<[string], number>(RELEASE_SCRIPT, [lock.key], [lock.token]);
  } catch (error) {
    console.error("[cron-single-flight] Upstash lock release failed; lock will expire by TTL", error);
  }
}

export function __clearCronSingleFlightMemoryLocksForTests() {
  memoryLocks.clear();
  redisClient = undefined;
}
