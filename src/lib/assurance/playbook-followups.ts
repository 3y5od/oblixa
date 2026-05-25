import type { AdminClient } from "@/lib/assurance/service";
import { createRow } from "@/lib/assurance/service";

/**
 * Seeds a durable operational recommendation so follow-up checks from playbook JSON are not only logged on steps.
 */
export async function seedPlaybookFollowUpRecommendations(
  admin: AdminClient,
  orgId: string,
  userId: string,
  playbookRunId: string,
  checks: string[],
  sourceFindingId: string | null
) {
  if (checks.length === 0) return;
  const { data: existing } = await admin
    .from("operational_recommendations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("recommendation_type", "v6_playbook_follow_up")
    .eq("target_ref_id", orgId)
    .contains("reason_json", [{ playbook_run_id: playbookRunId }])
    .limit(1)
    .maybeSingle();
  if (existing) return;
  await createRow(admin, "operational_recommendations", orgId, {
    recommendation_type: "v6_playbook_follow_up",
    target_ref_type: "organization",
    target_ref_id: orgId,
    recommendation_text: `Assurance playbook follow-up checks: ${checks.join(", ")}`,
    reason_json: [{ playbook_run_id: playbookRunId, checks, finding_id: sourceFindingId }],
    confidence: 68,
    created_by: userId,
    v6_outcome_tracking_json: { playbook_follow_up: true, playbook_run_id: playbookRunId },
  });
}
