import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";
import { listOrganizationIds, requireV5CronAuth } from "@/lib/v5/cron";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";

/** Recomputes progress_summary_json from portfolio_campaign_contracts row statuses only. */

export async function GET(request: Request) {
  const unauthorized = requireV5CronAuth(request);
  if (unauthorized) return unauthorized;
  const skipped = requireV5CronFeature("v5PortfolioCampaigns");
  if (skipped) return skipped;
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);

  let updated = 0;
  for (const orgId of orgIds) {
    let orgCampaignUpdates = 0;
    const { data: campaigns } = await admin
      .from("portfolio_campaigns")
      .select("id")
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"])
      .limit(100);

    for (const campaign of campaigns ?? []) {
      const [{ count: pending }, { count: inProgress }, { count: processed }, { count: failed }] =
        await Promise.all([
          admin
            .from("portfolio_campaign_contracts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("campaign_id", campaign.id)
            .eq("status", "pending"),
          admin
            .from("portfolio_campaign_contracts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("campaign_id", campaign.id)
            .eq("status", "in_progress"),
          admin
            .from("portfolio_campaign_contracts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("campaign_id", campaign.id)
            .eq("status", "processed"),
          admin
            .from("portfolio_campaign_contracts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("campaign_id", campaign.id)
            .eq("status", "failed"),
        ]);

      const { data: segRows } = await admin
        .from("portfolio_campaign_contracts")
        .select("segment_key, assigned_team, status")
        .eq("organization_id", orgId)
        .eq("campaign_id", campaign.id)
        .limit(5000);

      const emptyBucket = () => ({
        pending: 0,
        in_progress: 0,
        processed: 0,
        failed: 0,
        skipped: 0,
      });
      const segment_breakdown: Record<string, Record<string, number>> = {};
      const team_breakdown: Record<string, Record<string, number>> = {};
      const bumpSeg = (seg: string, st: string) => {
        if (!segment_breakdown[seg]) segment_breakdown[seg] = emptyBucket();
        const bucket = segment_breakdown[seg];
        if (st in bucket) bucket[st] += 1;
      };
      const bumpTeam = (team: string, st: string) => {
        if (!team_breakdown[team]) team_breakdown[team] = emptyBucket();
        const bucket = team_breakdown[team];
        if (st in bucket) bucket[st] += 1;
      };
      for (const r of segRows ?? []) {
        const st = String(r.status);
        const seg =
          r.segment_key && String(r.segment_key).trim()
            ? String(r.segment_key)
            : "_unsegmented";
        bumpSeg(seg, st);
        const team =
          r.assigned_team && String(r.assigned_team).trim()
            ? String(r.assigned_team)
            : "_unassigned";
        bumpTeam(team, st);
      }

      await admin
        .from("portfolio_campaigns")
        .update({
          progress_summary_json: {
            pending: pending ?? 0,
            in_progress: inProgress ?? 0,
            processed: processed ?? 0,
            failed: failed ?? 0,
            segment_breakdown,
            team_breakdown,
            refreshed_at: new Date().toISOString(),
          },
        })
        .eq("organization_id", orgId)
        .eq("id", campaign.id);
      updated += 1;
      orgCampaignUpdates += 1;
    }
    if (orgCampaignUpdates > 0) {
      await incrementOrgV5SignalQuality({
        admin,
        organizationId: orgId,
        increments: { v5_campaign_progress_cron_updates: orgCampaignUpdates },
      });
    }
  }

  return NextResponse.json({ ok: true, campaignsUpdated: updated });
}

