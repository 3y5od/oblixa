/**
 * Shared first-run blocking → Core minimal path (docs/onboarding.md §4.4, §24.2).
 * Used by server actions and stale-expiry cron so merge / transition / suppress order cannot drift.
 * §24.2: org JSON stays authoritative; `safeSuppressNotificationTypesForModeDowngradeCalibration` swallows
 * notification_policy upsert failures (Sentry org id only, no questionnaire payload) on every caller path.
 */
import * as Sentry from "@sentry/nextjs";
import { coreFallbackV6Patch } from "@/lib/onboarding/calibration-map";
import {
  ONBOARDING_CALIBRATION_JSON_VERSION,
  type CalibrationHistoryEntry,
  type OnboardingCalibrationState,
} from "@/lib/onboarding/calibration-types";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  applyWorkspaceProductTransitionSideEffects,
  suppressNotificationTypesForModeDowngrade,
} from "@/lib/product-surface/workspace-transition";
import type { AdminClient } from "@/lib/v6/service";
import { mergeV6OrgSettingsJson, type V6OrgSettingsJson } from "@/lib/v6/org-settings";

function nowIso(): string {
  return new Date().toISOString();
}

function baseCalibrationFrom(
  prev: OnboardingCalibrationState | undefined,
  patch: Partial<OnboardingCalibrationState>
): OnboardingCalibrationState {
  const base: OnboardingCalibrationState = prev ?? {
    version: ONBOARDING_CALIBRATION_JSON_VERSION,
    blocking_required: false,
    status: "pending",
  };
  return {
    ...base,
    ...patch,
    version: ONBOARDING_CALIBRATION_JSON_VERSION,
  };
}

/** Spec 24.2: org JSON is authoritative; notification_policy upsert is best-effort (no answer payloads on failure). */
export async function safeSuppressNotificationTypesForModeDowngradeCalibration(input: {
  admin: AdminClient;
  orgId: string;
  mode: WorkspaceProductMode;
}): Promise<void> {
  try {
    await suppressNotificationTypesForModeDowngrade(input);
  } catch {
    Sentry.captureMessage("onboarding.calibration_notification_policy_failed", {
      level: "error",
      extra: { orgId: input.orgId },
    });
  }
}

async function insertProductSurfaceAuditCalibration(input: {
  admin: AdminClient;
  orgId: string;
  userId: string;
  prevV6: V6OrgSettingsJson;
  merged: V6OrgSettingsJson;
  source: string;
  transition: Awaited<ReturnType<typeof applyWorkspaceProductTransitionSideEffects>>;
}) {
  const { admin, orgId, userId, prevV6, merged, source, transition } = input;
  const prevMode = parseWorkspaceMode(prevV6);
  await admin.from("audit_events").insert({
    organization_id: orgId,
    contract_id: null,
    user_id: userId,
    action: "workspace.product_surface_updated",
    details: {
      source,
      prev_workspace_mode: prevMode,
      next_workspace_mode: parseWorkspaceMode(merged),
      prev_default_landing_path: prevV6.default_landing_path ?? null,
      next_default_landing_path: merged.default_landing_path ?? null,
      prev_advanced_modules_hidden: prevV6.advanced_modules_hidden ?? [],
      next_advanced_modules_hidden: merged.advanced_modules_hidden ?? [],
      prev_assurance_modules_hidden: prevV6.assurance_modules_hidden ?? [],
      next_assurance_modules_hidden: merged.assurance_modules_hidden ?? [],
      prev_utility_modules_hidden: prevV6.utility_modules_hidden ?? [],
      next_utility_modules_hidden: merged.utility_modules_hidden ?? [],
      prev_home_hidden_sections: prevV6.home_hidden_sections ?? [],
      next_home_hidden_sections: merged.home_hidden_sections ?? [],
      prev_search_scope: prevV6.search_scope ?? "match_mode",
      next_search_scope: merged.search_scope ?? "match_mode",
      prev_autopilot_allow_execution: prevV6.autopilot_allow_execution === true,
      next_autopilot_allow_execution: merged.autopilot_allow_execution === true,
      auto_blocked_notification_types: transition.autoBlockedNotificationTypes,
      suppressed_report_pack_subscription_count: transition.suppressedSubscriptionCount,
    },
  });
}

export type BlockingMinimalChoice = "skip" | "simpler";

/**
 * Apply Core fallback + skipped calibration state for blocking first-run orgs.
 * Caller must validate blocking_required and status before calling.
 */
export async function applyBlockingCalibrationMinimalSkip(input: {
  admin: AdminClient;
  orgId: string;
  actorUserId: string;
  prevV6: V6OrgSettingsJson;
  prevCal: OnboardingCalibrationState;
  choice: BlockingMinimalChoice;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { admin, orgId, actorUserId, prevV6, prevCal, choice } = input;
  const prevMode = parseWorkspaceMode(prevV6);
  const completedAt = nowIso();
  const fallback = coreFallbackV6Patch();
  const nextCal = baseCalibrationFrom(prevCal, {
    blocking_required: false,
    status: "skipped",
    last_skipped_at: completedAt,
    questionnaire_completed_at: completedAt,
    history: [
      ...(prevCal.history ?? []),
      {
        at: completedAt,
        actor_user_id: actorUserId,
        prior_mode: prevMode,
        next_mode: "core" as WorkspaceProductMode,
        choice: (choice === "simpler" ? "simpler" : "skip") as CalibrationHistoryEntry["choice"],
      } satisfies CalibrationHistoryEntry,
    ].slice(-32),
  });
  const { data: merged, error } = await mergeV6OrgSettingsJson(admin, orgId, {
    ...fallback,
    onboarding_calibration: nextCal,
  });
  if (error || !merged) return { ok: false, error: error?.message ?? "Update failed." };
  const nextMode = parseWorkspaceMode(merged);
  const transition = await applyWorkspaceProductTransitionSideEffects({
    admin,
    orgId,
    userId: actorUserId,
    prevMode,
    nextMode,
  });
  await safeSuppressNotificationTypesForModeDowngradeCalibration({
    admin,
    orgId,
    mode: nextMode,
  });
  await insertProductSurfaceAuditCalibration({
    admin,
    orgId,
    userId: actorUserId,
    prevV6,
    merged,
    source: "onboarding_calibration",
    transition,
  });
  await admin.from("audit_events").insert([
    {
      organization_id: orgId,
      contract_id: null,
      user_id: actorUserId,
      action: "onboarding.questionnaire_skipped",
      details: { path: choice },
    },
    {
      organization_id: orgId,
      contract_id: null,
      user_id: actorUserId,
      action: "onboarding.questionnaire_completed",
      details: { choice },
    },
  ]);
  return { ok: true };
}
