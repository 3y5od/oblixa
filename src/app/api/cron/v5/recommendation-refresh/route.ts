import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { requireV5CronFeature } from "@/lib/decision-intelligence/feature-guards";
import { listOrganizationIds } from "@/lib/decision-intelligence/cron";
import { incrementOrgV5SignalQuality } from "@/lib/decision-intelligence/persist-signal-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v5/recommendation-refresh",
  rateLimitKey: "cron:v5:recommendation-refresh",
  rateLimit: RATE_LIMITS.v5CronDefault,
  preflight: () => requireV5CronFeature("v5SimulationAndIntelligence"),
  handler: async ({ admin }) => {
    const orgIds = await listOrganizationIds(admin);

    let created = 0;
    for (const orgId of orgIds) {
      await admin
        .from("operational_recommendations")
        .delete()
        .eq("organization_id", orgId)
        .eq("dismissed", false)
        .eq("accepted", false)
        .in("recommendation_type", [
          "review_priority_suggestion",
          "campaign_load_suggestion",
          "owner_coverage_suggestion",
        ]);

      const [{ count: openDecisions }, { count: activeCampaigns }] = await Promise.all([
        admin
          .from("decision_workspaces")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["open", "in_review"]),
        admin
          .from("portfolio_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "active"),
      ]);

      const decisionText =
        (openDecisions ?? 0) > 20
          ? "Decision queue is heavy. Consider reassigning approval routes and sequencing by due date."
          : "Decision queue is stable. Maintain current routing and monitor SLA drift.";

      await admin.from("operational_recommendations").insert({
        organization_id: orgId,
        recommendation_type: "review_priority_suggestion",
        priority: (openDecisions ?? 0) > 20 ? "high" : "medium",
        target_ref_type: "decision_queue",
        target_ref_id: orgId,
        recommendation_text: decisionText,
        reason_json: [
          { signal: "open_decisions", value: openDecisions ?? 0 },
          { signal: "active_campaigns", value: activeCampaigns ?? 0 },
        ],
        confidence: 72,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });
      created += 1;

      if ((activeCampaigns ?? 0) > 5) {
        await admin.from("operational_recommendations").insert({
          organization_id: orgId,
          recommendation_type: "campaign_load_suggestion",
          priority: "high",
          target_ref_type: "portfolio_campaigns",
          target_ref_id: orgId,
          recommendation_text:
            "Multiple active portfolio campaigns detected. Confirm capacity and pause lower-priority rollouts if execution risk is rising.",
          reason_json: [{ signal: "active_campaigns", value: activeCampaigns ?? 0 }],
          confidence: 68,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
        created += 1;
      }

      const { count: contractsWithoutOwner } = await admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("owner_id", null);

      if ((contractsWithoutOwner ?? 0) > 5) {
        await admin.from("operational_recommendations").insert({
          organization_id: orgId,
          recommendation_type: "owner_coverage_suggestion",
          priority: (contractsWithoutOwner ?? 0) > 25 ? "high" : "medium",
          target_ref_type: "contracts",
          target_ref_id: orgId,
          recommendation_text:
            "Several contracts have no owner assigned. Redistribute ownership or define coverage before SLA and renewal work stacks up.",
          reason_json: [{ signal: "contracts_without_owner", value: contractsWithoutOwner ?? 0 }],
          confidence: 70,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
        created += 1;
      }
      await incrementOrgV5SignalQuality({
        admin,
        organizationId: orgId,
        increments: { v5_recommendation_refresh_cron_runs: 1 },
      });
    }

    return {
      body: {
        recommendationsCreated: created,
      },
    };
  },
});

