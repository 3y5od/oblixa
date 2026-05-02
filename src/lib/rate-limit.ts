/**
 * Rate limiting: Upstash Redis when UPSTASH_* env is set (distributed),
 * else in-memory sliding window (single instance / dev).
 */

import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type WindowConfig = { max: number; windowMs: number };

const buckets = new Map<string, number[]>();

function prune(key: string, windowStart: number): number[] {
  const arr = buckets.get(key) ?? [];
  const next = arr.filter((t) => t > windowStart);
  buckets.set(key, next);
  return next;
}

export function rateLimitTake(
  key: string,
  { max, windowMs }: WindowConfig
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = prune(key, windowStart);
  if (timestamps.length >= max) {
    const oldest = Math.min(...timestamps);
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return { ok: false, retryAfterMs };
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return { ok: true };
}

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(max: number, windowMs: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const cacheKey = `${max}:${windowMs}`;
  let lim = upstashLimiters.get(cacheKey);
  if (!lim) {
    const sec = Math.max(1, Math.ceil(windowMs / 1000));
    const windowStr = `${sec} s` as `${number} s`;
    lim = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(max, windowStr),
      prefix: "oblixa:rl",
    });
    upstashLimiters.set(cacheKey, lim);
  }
  return lim;
}

export async function rateLimitCheck(
  key: string,
  config: WindowConfig
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const upstash = getUpstashLimiter(config.max, config.windowMs);
  if (!upstash) {
    return rateLimitTake(key, config);
  }
  try {
    const result = await upstash.limit(key);
    if (result.success) {
      return { ok: true };
    }
    const retryAfterMs = Math.max(0, result.reset - Date.now());
    return { ok: false, retryAfterMs };
  } catch (err) {
    console.error("[rate-limit] Upstash limit() failed; falling back to in-process window", err);
    return rateLimitTake(key, config);
  }
}

export const RATE_LIMITS = {
  /** AI extraction — costly */
  extract: { max: 20, windowMs: 60_000 },
  /** Internal POST /api/extract/run (bearer secret); limits abuse if secret leaks */
  extractWorker: { max: 120, windowMs: 60_000 },
  signIn: { max: 40, windowMs: 15 * 60_000 },
  /** Re-authenticate before sensitive actions (cookie mint). */
  stepUpPassword: { max: 15, windowMs: 15 * 60_000 },
  signUp: { max: 12, windowMs: 60 * 60_000 },
  forgotPassword: { max: 8, windowMs: 60 * 60_000 },
  inviteMember: { max: 40, windowMs: 60 * 60_000 },
  eventsRead: { max: 80, windowMs: 60_000 },
  tasksFromEmailInbound: { max: 60, windowMs: 60_000 },
  tasksFromSlackInbound: { max: 60, windowMs: 60_000 },
  integrationsActionsInbound: { max: 60, windowMs: 60_000 },
  /** Cron/internal safety valves */
  reportsSummariesCron: { max: 30, windowMs: 60_000 },
  tasksRunRulesCron: { max: 60, windowMs: 60_000 },
  webhooksDispatchCron: { max: 60, windowMs: 60_000 },
  notificationsRetryCron: { max: 60, windowMs: 60_000 },
  maintenancePruneCron: { max: 12, windowMs: 60_000 },
  v4ExceptionsDetectCron: { max: 60, windowMs: 60_000 },
  v4AttestationsIssueCron: { max: 60, windowMs: 60_000 },
  v4ApprovalSlaCron: { max: 60, windowMs: 60_000 },
  v4EscalationDispatchCron: { max: 60, windowMs: 60_000 },
  v4ReportPacksCron: { max: 60, windowMs: 60_000 },
  v4EvidenceFollowupCron: { max: 60, windowMs: 60_000 },
  v4ProgramReconcileCron: { max: 60, windowMs: 60_000 },
  v4RenewalSignalsCron: { max: 60, windowMs: 60_000 },
  /** Report email open pixel — high ceiling; IP-keyed */
  reportTrackOpen: { max: 240, windowMs: 60_000 },
  /** Report email click redirect */
  reportTrackClick: { max: 120, windowMs: 60_000 },
  /** Public external action POST (submit, participant workflow-step) */
  externalTokenMutate: { max: 40, windowMs: 60_000 },
  /** Public external action GET (status poll) */
  externalTokenRead: { max: 120, windowMs: 60_000 },
  /** Session-backed external workflow-step (internal staff) */
  externalWorkflowStepInternal: { max: 80, windowMs: 60_000 },
  /** V5 cron batch jobs (CRON_SECRET + optional feature skip) */
  v5CronDefault: { max: 60, windowMs: 60_000 },
  /** V6 cron batch jobs */
  v6CronDefault: { max: 60, windowMs: 60_000 },
  contractsRecomputeSignalsCron: { max: 30, windowMs: 60_000 },
  /** Stripe webhook after signature verification */
  stripeWebhook: { max: 200, windowMs: 60_000 },
  remindersSendCron: { max: 30, windowMs: 60_000 },
  reportsCaptureMetricsCron: { max: 30, windowMs: 60_000 },
  exportContractsCsv: { max: 30, windowMs: 60_000 },
  /** Poll GET /api/export/contracts/[jobId] for job status (mirrors import job poll ceiling). */
  exportContractsJob: { max: 40, windowMs: 60_000 },
  exportCalendar: { max: 30, windowMs: 60_000 },
  /** Authenticated self-service data export (DSR-style JSON). */
  dsrSelfExport: { max: 10, windowMs: 60_000 },
  exportReviewPacket: { max: 15, windowMs: 60_000 },
  importContractsJob: { max: 40, windowMs: 60_000 },
  integrationCalendarSync: { max: 20, windowMs: 60_000 },
  integrationCrmSync: { max: 20, windowMs: 60_000 },
  integrationRefreshTokens: { max: 40, windowMs: 60_000 },
  stripeCheckoutSession: { max: 20, windowMs: 60_000 },
  stripePortalSession: { max: 20, windowMs: 60_000 },
  templatesPreview: { max: 40, windowMs: 60_000 },
  /**
   * Onboarding questionnaire server actions — user+IP keyed via callers.
   * When UPSTASH_REDIS_* is unset, limits are in-process (per instance), not global; acceptable for UX gates and actions; cron IP limits remain best-effort per instance.
   */
  onboardingCalibrationMutation: { max: 45, windowMs: 60_000 },
  onboardingCalibrationPreview: { max: 90, windowMs: 60_000 },
  onboardingCalibrationExport: { max: 12, windowMs: 60_000 },
  /** Proxy / RLS gate: user-keyed only (no IP throttle for anonymous paths here). */
  onboardingCalibrationGateUser: { max: 120, windowMs: 60_000 },
  /** Auth callback hot path: high ceiling to bound pathological loops only. */
  onboardingCalibrationGateAdmin: { max: 180, windowMs: 60_000 },
  /** V6 stale calibration cron — same ceiling as v6CronDefault; dedicated key prefix in route. */
  v6OnboardingCalibrationStaleCron: { max: 60, windowMs: 60_000 },
  /** V9 product telemetry server actions (CmdK, page load, review save-next) — user+IP keyed. */
  productV9Telemetry: { max: 240, windowMs: 60_000 },
  /** Gated internal debugging sweep diagnostics (bearer + env). */
  internalDebuggingSweep: { max: 30, windowMs: 60_000 },
} as const;

export function getClientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function getClientIpFromHeaders(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return h.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}
