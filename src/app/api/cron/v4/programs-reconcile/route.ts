import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { recordAutomationEvent } from "@/lib/contract-operations/automation-audit";
import { backfillAutoAttachPrograms } from "@/lib/contract-operations/program-auto-attach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/programs-reconcile",
  healthcheckRoute: "cron/v4/programs-reconcile",
  rateLimitKey: "cron:v4:programs-reconcile",
  rateLimit: RATE_LIMITS.v4ProgramReconcileCron,
  handler: async ({ admin }) => {
    const { data: programs } = await admin
      .from("contract_programs")
      .select("id, organization_id")
      .eq("state", "published")
      .limit(500);

    let fixed = 0;
    for (const program of programs ?? []) {
      const { data: latestVersion } = await admin
        .from("contract_program_versions")
        .select("id")
        .eq("organization_id", program.organization_id)
        .eq("program_id", program.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestVersion) continue;
      const { error } = await admin
        .from("contract_programs")
        .update({ current_version_id: latestVersion.id })
        .eq("id", program.id)
        .neq("current_version_id", latestVersion.id);
      if (!error) {
        fixed += 1;
        await recordAutomationEvent({
          admin,
          organizationId: program.organization_id,
          action: "programs_reconcile",
          entityType: "contract_program",
          entityId: program.id,
          details: { current_version_id: latestVersion.id },
        });
      }
    }

    const orgIds = [...new Set((programs ?? []).map((p) => p.organization_id as string))];
    let autoAttachScanned = 0;
    let autoAttachProgramsAttached = 0;
    for (const organizationId of orgIds.slice(0, 40)) {
      const r = await backfillAutoAttachPrograms({ admin, organizationId });
      autoAttachScanned += r.scanned;
      autoAttachProgramsAttached += r.attached;
    }

    return {
      body: {
        reconciledPrograms: fixed,
        autoAttachScanned,
        autoAttachProgramsAttached,
      },
    };
  },
});
