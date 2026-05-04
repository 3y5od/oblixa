import { withCronRoute } from "@/lib/cron/route-runner";
import { runTaskAutomationRulesForOrg } from "@/lib/tasks/run-task-automation-rules-for-org";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/tasks/run-rules",
  rateLimitKey: "cron:tasks:run-rules",
  rateLimit: RATE_LIMITS.tasksRunRulesCron,
  handler: async ({ admin }) => {
    let generated = 0;
    let evaluatedRules = 0;
    let organizationsCount = 0;
    const errors: string[] = [];

    const pageResult = await forEachSupabaseRangePage(
      (from, to) =>
        admin
          .from("organizations")
          .select("id")
          .order("created_at", { ascending: true })
          .range(from, to),
      async (chunk) => {
        organizationsCount += chunk.length;
        for (const org of chunk) {
          try {
            const res = await runTaskAutomationRulesForOrg(admin, org.id);
            generated += res.generated;
            evaluatedRules += res.evaluatedRules;
          } catch (error) {
            const message = error instanceof Error ? error.message : "automation_rule_execution_failed";
            errors.push(`${org.id}: ${message}`);
          }
        }
      },
      { pageSize: 200, maxOffsetExclusive: 20_000 }
    );

    if (pageResult.error) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        body: {
          error: "Failed to load organizations for automation rules",
          code: "task_rule_org_scan_failed",
          diagnostic_id: "task_rule_org_scan_failed",
        },
      };
    }

    return {
      partial: errors.length > 0,
      errorsCount: errors.length,
      body: {
        organizations: organizationsCount,
        evaluatedRules,
        generated,
        ...(errors.length > 0 ? { errors } : {}),
      },
    };
  },
});
