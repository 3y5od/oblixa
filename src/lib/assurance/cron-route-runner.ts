import type { NextResponse } from "next/server";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { withCronRoute, type CronRouteHandlerResult } from "@/lib/cron/route-runner";
import type { BatchItemError, RouteFailurePhase } from "@/lib/route-runtime-contract";
import { requireV6CronFeature } from "@/lib/assurance/feature-guards";
import { listOrganizationIds, v6CronRunMetadata, type V6OrganizationIdScanResult } from "@/lib/assurance/cron";
import type { AdminClient } from "@/lib/assurance/service";

export type V6CronRouteContext = {
  request: Request;
  admin: AdminClient;
  startedAtMs: number;
  orgIds: string[];
  orgDiscovery: V6OrganizationIdScanResult;
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
      const orgDiscovery = await listOrganizationIds(admin);
      if (orgDiscovery.error) {
        return {
          status: 500,
          ok: false,
          errorsCount: 1,
          phase: "source_query",
          body: {
            error: "Failed to load organizations for V6 cron job",
            code: "v6_cron_organization_query_failed",
            diagnostic_id: "v6_cron_organization_query_failed",
            rows_seen: orgDiscovery.orgIds.length,
            next_offset: orgDiscovery.nextOffset,
          },
        };
      }
      return options.handler({ request, admin, startedAtMs, orgIds: orgDiscovery.orgIds, orgDiscovery });
    },
  });
}

export function v6CronMeta(orgIds: readonly string[], startedAtMs: number, errorsCount = 0) {
  return v6CronRunMetadata(orgIds.length, startedAtMs, errorsCount);
}

type V6CronStructuredResult = {
  errors?: BatchItemError[];
  orgsSucceeded?: number;
  orgsFailed?: number;
  orgsSkipped?: number;
};

export function buildV6CronRouteResult(input: {
  startedAtMs: number;
  orgDiscovery: V6OrganizationIdScanResult;
  result: V6CronStructuredResult;
  body: Record<string, unknown>;
  phase?: RouteFailurePhase;
}): CronRouteHandlerResult {
  const errors = input.result.errors ?? [];
  const partial = errors.length > 0 || input.orgDiscovery.stoppedByOffsetCap;
  return {
    partial,
    errorsCount: errors.length,
    phase: input.phase ?? errors[0]?.phase,
    body: {
      ...input.body,
      ...v6CronRunMetadata(input.orgDiscovery.orgIds.length, input.startedAtMs, errors.length),
      orgs_succeeded: input.result.orgsSucceeded ?? 0,
      orgs_failed: input.result.orgsFailed ?? 0,
      orgs_skipped: input.result.orgsSkipped ?? 0,
      ...(input.orgDiscovery.stoppedByOffsetCap
        ? {
            truncated: true,
            next_offset: input.orgDiscovery.nextOffset,
          }
        : {}),
      ...(errors.length > 0
        ? {
            errors: errors.map((entry) => `${entry.scope}: ${entry.message}`),
            error_details: errors.slice(0, 10),
          }
        : {}),
    },
  };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV6CronRouteResult as buildCronRouteResult };
export { v6CronMeta as cronMeta };
export { withV6CronRoute as withCronRoute };
export type { V6CronRouteContext as CronRouteContext };
export type { V6CronRouteOptions as CronRouteOptions };
// End version-name compatibility aliases.
