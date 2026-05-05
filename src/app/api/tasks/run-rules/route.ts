import { withCronRoute } from "@/lib/cron/route-runner";
import { runTaskAutomationRulesForOrg } from "@/lib/tasks/run-task-automation-rules-for-org";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";
import {
  executeBatch,
  safeErrorMessage,
  type BatchItemError,
} from "@/lib/route-runtime-contract";

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
    const errors: BatchItemError[] = [];

    const pageResult = await forEachSupabaseRangePage(
      (from, to) =>
        admin
          .from("organizations")
          .select("id")
          .order("created_at", { ascending: true })
          .range(from, to),
      async (chunk) => {
        organizationsCount += chunk.length;
        const batch = await executeBatch(chunk, async (org) => {
          try {
            const res = await runTaskAutomationRulesForOrg(admin, org.id);
            generated += res.generated;
            evaluatedRules += res.evaluatedRules;
            errors.push(...(res.errors ?? []));
            return;
          } catch (error) {
            return {
              scope: org.id,
              phase: "handler",
              diagnostic_id: "task_rule_org_execution_failed",
              message: safeErrorMessage(error) ?? "automation_rule_execution_failed",
            };
          }
        });
        errors.push(...batch.errors);
      },
      { pageSize: 200, maxOffsetExclusive: 20_000 }
    );

    if (pageResult.error) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Failed to load organizations for automation rules",
          code: "task_rule_org_scan_failed",
          diagnostic_id: "task_rule_org_scan_failed",
        },
      };
    }

    return {
      partial: errors.length > 0 || pageResult.stoppedByOffsetCap,
      errorsCount: errors.length,
      phase: errors[0]?.phase,
      body: {
        organizations: organizationsCount,
        evaluatedRules,
        generated,
        truncated: pageResult.stoppedByOffsetCap,
        next_offset: pageResult.nextOffset,
        ...(errors.length > 0
          ? {
              errors: errors.map((entry) => `${entry.scope}: ${entry.message}`),
              error_details: errors.slice(0, 10),
            }
          : {}),
      },
    };
  },
});
