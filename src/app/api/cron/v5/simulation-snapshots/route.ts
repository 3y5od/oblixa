import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { requireV5CronFeature } from "@/lib/decision-intelligence/feature-guards";
import { listOrganizationIds } from "@/lib/decision-intelligence/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v5/simulation-snapshots",
  rateLimitKey: "cron:v5:simulation-snapshots",
  rateLimit: RATE_LIMITS.v5CronDefault,
  preflight: () => requireV5CronFeature("v5SimulationAndIntelligence"),
  handler: async ({ admin }) => {
    const orgIds = await listOrganizationIds(admin);

    let runsCreated = 0;
    for (const orgId of orgIds) {
      const { data: simulations } = await admin
        .from("change_simulations")
        .select("id, simulation_type")
        .eq("organization_id", orgId)
        .limit(100);
      for (const simulation of simulations ?? []) {
        await admin.from("change_simulation_runs").insert({
          organization_id: orgId,
          simulation_id: simulation.id,
          status: "completed",
          result_json: {
            snapshot: true,
            simulation_type: simulation.simulation_type,
            captured_at: new Date().toISOString(),
          },
        });
        runsCreated += 1;
      }
    }

    return {
      body: {
        snapshotRunsCreated: runsCreated,
      },
    };
  },
});

