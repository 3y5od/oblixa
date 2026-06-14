import { withCronRoute } from "@/lib/cron/route-runner";
import { handleCrmSyncCron } from "@/lib/integrations/crm-sync-route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  isKillIntegrationSync,
  killSwitchJsonResponse,
} from "@/lib/security/kill-switches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/integrations/crm/sync",
  healthcheckRoute: "integrations/crm/sync",
  rateLimitKey: "cron:integrations:crm-sync",
  rateLimit: RATE_LIMITS.integrationCrmSync,
  preflight: () =>
    isKillIntegrationSync() ? killSwitchJsonResponse("integration_sync") : null,
  handler: handleCrmSyncCron,
});
