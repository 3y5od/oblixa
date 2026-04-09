import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";
import { listOrganizationIds, requireV5CronAuth } from "@/lib/v5/cron";

export async function GET(request: Request) {
  const unauthorized = requireV5CronAuth(request);
  if (unauthorized) return unauthorized;
  const skipped = requireV5CronFeature("v5SimulationAndIntelligence");
  if (skipped) return skipped;
  const admin = await createAdminClient();
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

  return NextResponse.json({ ok: true, snapshotRunsCreated: runsCreated });
}

