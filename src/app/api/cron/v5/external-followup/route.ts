import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";
import { listOrganizationIds, requireV5CronAuth } from "@/lib/v5/cron";

export async function GET(request: Request) {
  const unauthorized = requireV5CronAuth(request);
  if (unauthorized) return unauthorized;
  const skipped = requireV5CronFeature("v5ExternalCollaboration");
  if (skipped) return skipped;
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);

  let expired = 0;
  for (const orgId of orgIds) {
    const { data: links } = await admin
      .from("external_action_links")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .lt("expires_at", new Date().toISOString())
      .limit(1000);

    for (const link of links ?? []) {
      await admin
        .from("external_action_links")
        .update({ status: "expired" })
        .eq("organization_id", orgId)
        .eq("id", link.id);
      await admin.from("external_action_events").insert({
        organization_id: orgId,
        external_action_link_id: link.id,
        event_type: "external.link_expired",
        payload_json: {},
      });
      expired += 1;
    }
  }

  return NextResponse.json({ ok: true, expiredLinks: expired });
}

