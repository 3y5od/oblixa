import type { createAdminClient } from "@/lib/supabase/server";
import { mergeV5SignalQuality } from "@/lib/v5/signal-quality-merge";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

function metricsDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Upserts today's org_behavior_metrics row; merges v5_signal_quality_json only. */
export async function incrementOrgV5SignalQuality(params: {
  admin: Admin;
  organizationId: string;
  increments: Record<string, number>;
}): Promise<void> {
  const { admin, organizationId, increments } = params;
  if (Object.keys(increments).length === 0) return;

  const metrics_date = metricsDateUtc();
  const { data: existing } = await admin
    .from("org_behavior_metrics")
    .select("id, v5_signal_quality_json")
    .eq("organization_id", organizationId)
    .eq("metrics_date", metrics_date)
    .maybeSingle();

  const merged = mergeV5SignalQuality(existing?.v5_signal_quality_json, increments);

  if (existing?.id) {
    await admin.from("org_behavior_metrics").update({ v5_signal_quality_json: merged }).eq("id", existing.id);
    return;
  }

  await admin.from("org_behavior_metrics").insert({
    organization_id: organizationId,
    metrics_date,
    v5_signal_quality_json: merged,
  });
}
