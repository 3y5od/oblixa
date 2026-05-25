import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV5CronFeature } from "@/lib/decision-intelligence/feature-guards";
import { listOrganizationIds } from "@/lib/decision-intelligence/cron";
import { recordMissedExternalDeadlineFinding } from "@/lib/assurance/external-collaboration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v5/external-followup",
  rateLimitKey: "cron:v5:external-followup",
  rateLimit: RATE_LIMITS.v5CronDefault,
  preflight: () => requireV5CronFeature("v5ExternalCollaboration"),
  handler: async ({ admin }) => {
    const orgIds = await listOrganizationIds(admin);

    let expired = 0;
    for (const orgId of orgIds) {
      const { data: links } = await admin
        .from("external_action_links")
        .select("id, action_type")
        .eq("organization_id", orgId)
        .eq("status", "open")
        .lt("expires_at", new Date().toISOString())
        .limit(1000);

      for (const link of links ?? []) {
        await admin
          .from("external_action_links")
          .update({ status: "expired" })
          .eq("organization_id", orgId)
          .eq("id", link.id);
        await admin.from("external_action_events").insert({
          organization_id: orgId,
          external_action_link_id: link.id,
          event_type: "external.link_expired",
          payload_json: {},
        });
        if (isFeatureEnabled("v6AssuranceCore")) {
          await recordMissedExternalDeadlineFinding(
            admin,
            orgId,
            String(link.id),
            String((link as { action_type?: string }).action_type ?? "external")
          ).catch(() => undefined);
        }
        expired += 1;
      }
    }

    return {
      body: {
        expiredLinks: expired,
      },
    };
  },
});

