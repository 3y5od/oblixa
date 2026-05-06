/**
 * Side effects when workspace product mode moves to a lower tier (product-surface policy §18).
 * Extracted from product-surface-settings for reuse (onboarding calibration).
 */
import { notificationTypesBlockedByMode } from "@/lib/notification-product-tier";
import type { AdminClient } from "@/lib/v6/service";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  minWorkspaceModeForReportType,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";

function modeRank(mode: WorkspaceProductMode): number {
  if (mode === "assurance") return 2;
  if (mode === "advanced") return 1;
  return 0;
}

export type WorkspaceReportSubscriptionSnapshot = {
  id: string;
  report_pack_id: string;
};

export type WorkspaceReportPackSnapshot = {
  id: string;
  report_type: string;
};

export function reportSubscriptionIdsIneligibleForWorkspaceMode(input: {
  mode: WorkspaceProductMode;
  subscriptions: readonly WorkspaceReportSubscriptionSnapshot[];
  packs: readonly WorkspaceReportPackSnapshot[];
}): string[] {
  const packTypeById = new Map(input.packs.map((row) => [String(row.id), String(row.report_type ?? "")]));
  return input.subscriptions
    .filter((sub) => {
      const reportType = packTypeById.get(String(sub.report_pack_id)) ?? "";
      const minMode = minWorkspaceModeForReportType(reportType);
      return !workspaceModeAtLeast(input.mode, minMode);
    })
    .map((sub) => String(sub.id))
    .filter(Boolean);
}

export async function suppressNotificationTypesForModeDowngrade(input: {
  admin: AdminClient;
  orgId: string;
  mode: WorkspaceProductMode;
}): Promise<string[]> {
  const { admin, orgId, mode } = input;
  const blockedByMode = notificationTypesBlockedByMode(mode);
  if (blockedByMode.length === 0) return [];

  const { data: row } = await admin
    .from("organization_workflow_settings")
    .select(
      "notification_policy_json, weekly_intake_lookback_days, renewal_horizon_days, stale_contract_days, stale_ownership_days"
    )
    .eq("organization_id", orgId)
    .maybeSingle();

  const prev = (row?.notification_policy_json ?? {}) as Record<string, unknown>;
  const prevEmail = (prev.email ?? {}) as Record<string, unknown>;
  const prevSlack = (prev.slack ?? {}) as Record<string, unknown>;
  const prevBlockedEmail = Array.isArray(prevEmail.blocked_types)
    ? (prevEmail.blocked_types as unknown[]).map((v) => String(v))
    : [];
  const prevBlockedSlack = Array.isArray(prevSlack.blocked_types)
    ? (prevSlack.blocked_types as unknown[]).map((v) => String(v))
    : [];
  const nextBlockedEmail = [...new Set([...prevBlockedEmail, ...blockedByMode])];
  const nextBlockedSlack = [...new Set([...prevBlockedSlack, ...blockedByMode])];
  const autoBlocked = blockedByMode.filter((t) => !prevBlockedEmail.includes(t));

  const nextPolicy = {
    ...prev,
    email: {
      ...prevEmail,
      blocked_types: nextBlockedEmail,
    },
    slack: {
      ...prevSlack,
      blocked_types: nextBlockedSlack,
    },
  };

  const { error: upsertError } = await admin.from("organization_workflow_settings").upsert(
    {
      organization_id: orgId,
      weekly_intake_lookback_days: row?.weekly_intake_lookback_days ?? 7,
      renewal_horizon_days: row?.renewal_horizon_days ?? 90,
      stale_contract_days: row?.stale_contract_days ?? 120,
      stale_ownership_days: row?.stale_ownership_days ?? 90,
      notification_policy_json: nextPolicy,
    },
    { onConflict: "organization_id", ignoreDuplicates: false }
  );
  if (upsertError) {
    console.error("[workspace-transition] notification policy upsert failed", upsertError);
  }

  return autoBlocked;
}

export async function applyWorkspaceProductTransitionSideEffects(input: {
  admin: AdminClient;
  orgId: string;
  userId: string;
  prevMode: WorkspaceProductMode;
  nextMode: WorkspaceProductMode;
}): Promise<{ autoBlockedNotificationTypes: string[]; suppressedSubscriptionCount: number }> {
  const { admin, orgId, userId, prevMode, nextMode } = input;
  if (modeRank(nextMode) >= modeRank(prevMode)) {
    return { autoBlockedNotificationTypes: [], suppressedSubscriptionCount: 0 };
  }

  const autoBlockedNotificationTypes = await suppressNotificationTypesForModeDowngrade({
    admin,
    orgId,
    mode: nextMode,
  });

  const { data: activeSubs } = await admin
    .from("report_pack_subscriptions")
    .select("id, report_pack_id")
    .eq("organization_id", orgId)
    .eq("active", true);
  const packIds = [...new Set((activeSubs ?? []).map((row) => String(row.report_pack_id)))].filter(Boolean);
  if (packIds.length === 0) {
    return { autoBlockedNotificationTypes, suppressedSubscriptionCount: 0 };
  }

  const { data: packs } = await admin
    .from("report_packs")
    .select("id, report_type")
    .eq("organization_id", orgId)
    .in("id", packIds);
  const deactivateIds = reportSubscriptionIdsIneligibleForWorkspaceMode({
    mode: nextMode,
    subscriptions: (activeSubs ?? []).map((sub) => ({
      id: String(sub.id),
      report_pack_id: String(sub.report_pack_id),
    })),
    packs: (packs ?? []).map((pack) => ({
      id: String(pack.id),
      report_type: String(pack.report_type ?? ""),
    })),
  });
  if (deactivateIds.length === 0) {
    return { autoBlockedNotificationTypes, suppressedSubscriptionCount: 0 };
  }

  const { error: updateError } = await admin
    .from("report_pack_subscriptions")
    .update({ active: false })
    .in("id", deactivateIds)
    .eq("organization_id", orgId);
  if (updateError) {
    console.error("[workspace-transition] report_pack_subscriptions deactivation failed", updateError);
  }
  try {
    const { error: auditError } = await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: null,
      user_id: userId,
      action: "workspace.report_pack_subscriptions_suppressed",
      details: {
        prev_workspace_mode: prevMode,
        next_workspace_mode: nextMode,
        suppressed_count: deactivateIds.length,
        reason: "workspace_mode_downgrade",
      },
    });
    if (auditError) {
      console.error("[workspace-transition] report subscription suppression audit failed", auditError);
    }
  } catch (error) {
    console.error("[workspace-transition] report subscription suppression audit threw", error);
  }
  return { autoBlockedNotificationTypes, suppressedSubscriptionCount: deactivateIds.length };
}
