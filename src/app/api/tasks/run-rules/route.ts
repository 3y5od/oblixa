import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/security/cron-route-gate";
import { createAdminClient } from "@/lib/supabase/server";
import { runTaskAutomationRulesForOrg } from "@/lib/tasks/run-task-automation-rules-for-org";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const deny = gateCronRequest(request);
  if (deny) {
    pingCronHealthcheck("tasks/run-rules", {
      ok: false,
      status: deny.status,
      durationMs: Date.now() - startedAt,
    });
    return deny;
  }
  const cronRate = await rateLimitCheck("cron:tasks:run-rules", RATE_LIMITS.tasksRunRulesCron);
  if (!cronRate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: cronRate.retryAfterMs },
      { status: 429 }
    );
  }

  const admin = await createAdminClient();
  let generated = 0;
  let evaluatedRules = 0;
  let organizationsCount = 0;
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
        const res = await runTaskAutomationRulesForOrg(admin, org.id);
        generated += res.generated;
        evaluatedRules += res.evaluatedRules;
      }
    },
    { pageSize: 200, maxOffsetExclusive: 20_000 }
  );
  if (pageResult.error) {
    return NextResponse.json(
      { error: "Failed to load organizations for automation rules" },
      { status: 500 }
    );
  }

  const payload = {
    organizations: organizationsCount,
    evaluatedRules,
    generated,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("tasks/run-rules", payload);
  return NextResponse.json(payload);
}
