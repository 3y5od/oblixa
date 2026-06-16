type PolicyChannel = {
  enabled?: unknown;
  quiet_hours_start_utc?: unknown;
  quiet_hours_end_utc?: unknown;
  blocked_types?: unknown;
};

type NotificationPolicy = {
  email?: PolicyChannel;
  slack?: PolicyChannel;
};

export function asPolicy(value: unknown): NotificationPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as NotificationPolicy;
}

export function blockedTypes(channel: PolicyChannel | undefined): Set<string> {
  if (!Array.isArray(channel?.blocked_types)) return new Set();
  return new Set(channel.blocked_types.map((value) => String(value)));
}

export function hourValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(23, Math.max(0, Math.trunc(parsed)));
}

export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
