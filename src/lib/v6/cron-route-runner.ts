import type { NextResponse } from "next/server";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { withCronRoute, type CronRouteHandlerResult } from "@/lib/cron/route-runner";
import { requireV6CronFeature } from "@/lib/v6/feature-guards";
import { listOrganizationIds, v6CronRunMetadata } from "@/lib/v6/cron";
import type { AdminClient } from "@/lib/v6/service";

export type V6CronRouteContext = {
  request: Request;
  admin: AdminClient;
  startedAtMs: number;
  orgIds: string[];
};

export type V6CronRouteOptions = {
  route: `/api/cron/v6/${string}`;
  feature: FeatureFlagKey;
  rateLimitKey?: string | ((request: Request) => Promise<string> | string);
  preflight?: (request: Request) => Promise<NextResponse | null> | NextResponse | null;
  handler: (ctx: V6CronRouteContext) => Promise<CronRouteHandlerResult | Record<string, unknown>>;
};

export function withV6CronRoute(options: V6CronRouteOptions) {
  return withCronRoute({
    route: options.route,
    rateLimitKey: options.rateLimitKey ?? `cron:v6:${options.route.split("/").pop() ?? "job"}`,
    rateLimit: RATE_LIMITS.v6CronDefault,
    preflight: async (request) => options.preflight?.(request) ?? requireV6CronFeature(options.feature),
    handler: async ({ request, admin, startedAtMs }) => {
      const orgIds = await listOrganizationIds(admin);
      return options.handler({ request, admin, startedAtMs, orgIds });
    },
  });
}

export function v6CronMeta(orgIds: readonly string[], startedAtMs: number, errorsCount = 0) {
  return v6CronRunMetadata(orgIds.length, startedAtMs, errorsCount);
}