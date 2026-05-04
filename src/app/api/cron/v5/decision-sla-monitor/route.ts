import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";
import { listOrganizationIds } from "@/lib/v5/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v5/decision-sla-monitor",
  healthcheckRoute: "cron/v5/decision-sla-monitor",
  rateLimitKey: "cron:v5:decision-sla-monitor",
  rateLimit: RATE_LIMITS.v5CronDefault,
  preflight: () => requireV5CronFeature("v5DecisionFoundation"),
  handler: async ({ admin }) => {
    const orgIds = await listOrganizationIds(admin);

    let breaches = 0;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const dedupeMs = 24 * 60 * 60 * 1000;
    for (const orgId of orgIds) {
      const { data: atRisk } = await admin
        .from("decision_workspaces")
        .select("id, metadata_json")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .not("due_at", "is", null)
        .lt("due_at", nowIso)
        .limit(1000);

      for (const row of atRisk ?? []) {
        const meta = (row.metadata_json ?? {}) as Record<string, unknown>;
        const last = meta.last_sla_breach_event_at;
        const lastMs = typeof last === "string" ? Date.parse(last) : NaN;
        if (Number.isFinite(lastMs) && nowMs - lastMs < dedupeMs) continue;

        await admin.from("decision_workspace_events").insert({
          organization_id: orgId,
          decision_workspace_id: row.id,
          event_type: "decision.sla_breach_detected",
          payload_json: { detected_at: nowIso },
        });
        await admin
          .from("decision_workspaces")
          .update({
            metadata_json: {
              ...meta,
              last_sla_breach_event_at: nowIso,
            },
          })
          .eq("organization_id", orgId)
          .eq("id", row.id);
        breaches += 1;
      }
    }

    return {
      body: {
        slaBreachesDetected: breaches,
      },
    };
  },
});

