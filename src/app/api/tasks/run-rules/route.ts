import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { runTaskAutomationRulesForOrg } from "@/actions/automation";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return authorizeCronRequest(request, cronSecret);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    pingCronHealthcheck("tasks/run-rules", {
      ok: false,
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();
  const { data: organizations } = await admin.from("organizations").select("id");
  let generated = 0;
  for (const org of organizations ?? []) {
    const res = await runTaskAutomationRulesForOrg(admin, org.id);
    generated += res.generated;
  }

  const payload = {
    organizations: organizations?.length ?? 0,
    generated,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("tasks/run-rules", payload);
  return NextResponse.json(payload);
}
