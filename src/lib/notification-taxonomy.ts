import type { FeatureFamilyKey } from "@/lib/product-surface/feature-registry";
import type { NotificationProductTier } from "@/lib/product-surface/types";

export type NotificationTaxonomyEntry = {
  notificationType: string;
  tier: NotificationProductTier;
  featureFamily: FeatureFamilyKey;
};

/**
 * Canonical notification taxonomy for delivery-level `notification_type` values.
 * This is the single source of truth for tier + family mapping.
 */
export const NOTIFICATION_TAXONOMY: NotificationTaxonomyEntry[] = [
  { notificationType: "reminder_due", tier: "core", featureFamily: "work" },
  { notificationType: "saved_view_summary", tier: "core", featureFamily: "reports" },
  { notificationType: "automation_rule", tier: "core", featureFamily: "work" },
  { notificationType: "approval_requested", tier: "core", featureFamily: "review" },
  { notificationType: "approval_resolved", tier: "core", featureFamily: "review" },
  { notificationType: "task_assigned", tier: "core", featureFamily: "work" },
  { notificationType: "obligation_due", tier: "core", featureFamily: "work" },
  { notificationType: "renewal_due", tier: "core", featureFamily: "renewals" },
  { notificationType: "exception_assigned", tier: "core", featureFamily: "exceptions" },
  { notificationType: "review_backlog", tier: "core", featureFamily: "review" },
  { notificationType: "mention", tier: "core", featureFamily: "collaboration" },
  { notificationType: "decision_assignment", tier: "advanced", featureFamily: "decisions" },
  { notificationType: "decision_review_request", tier: "advanced", featureFamily: "decisions" },
  { notificationType: "campaign_status_change", tier: "advanced", featureFamily: "campaigns" },
  { notificationType: "relationship_alert", tier: "advanced", featureFamily: "relationship_workspaces" },
  { notificationType: "simulation_promotion_result", tier: "advanced", featureFamily: "advanced_analytics" },
  { notificationType: "campaign_digest", tier: "advanced", featureFamily: "campaigns" },
  { notificationType: "finding_opened", tier: "assurance", featureFamily: "findings" },
  { notificationType: "control_failure", tier: "assurance", featureFamily: "control_policies" },
  { notificationType: "scorecard_drop", tier: "assurance", featureFamily: "scorecards" },
  { notificationType: "playbook_run_requested", tier: "assurance", featureFamily: "playbooks" },
  { notificationType: "autopilot_action_completed", tier: "assurance", featureFamily: "autopilot" },
  { notificationType: "review_board_ready", tier: "assurance", featureFamily: "review_boards" },
  { notificationType: "outcome_analysis_updated", tier: "assurance", featureFamily: "outcome_intelligence" },
  { notificationType: "review_board_packet", tier: "assurance", featureFamily: "review_boards" },
  { notificationType: "review_board_slack", tier: "assurance", featureFamily: "review_boards" },
];

export const NOTIFICATION_TAXONOMY_BY_TYPE = new Map(
  NOTIFICATION_TAXONOMY.map((entry) => [entry.notificationType, entry])
);
