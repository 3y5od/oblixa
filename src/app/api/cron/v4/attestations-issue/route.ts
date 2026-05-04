import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/attestations-issue",
  healthcheckRoute: "cron/v4/attestations-issue",
  rateLimitKey: "cron:v4:attestations-issue",
  rateLimit: RATE_LIMITS.v4AttestationsIssueCron,
  handler: async ({ admin }) => {
    const now = new Date().toISOString();
    const { data: requests } = await admin
      .from("attestation_requests")
      .select("id, organization_id, contract_id")
      .in("status", ["open", "overdue"])
      .lte("due_at", now)
      .limit(500);

    if ((requests?.length ?? 0) > 0) {
      await admin
        .from("attestation_requests")
        .update({ status: "overdue", last_reminded_at: now })
        .in("id", (requests ?? []).map((r) => r.id));
    }

    const orgIds = new Set((requests ?? []).map((row) => row.organization_id));
    for (const orgId of orgIds) {
      await recordAutomationEvent({
        admin,
        organizationId: orgId,
        action: "attestations_issue",
        details: { overdueMarked: requests?.length ?? 0 },
      });
    }

    return {
      body: {
        issued: requests?.length ?? 0,
      },
    };
  },
});
