"use server";

// FUTURE(i18n): extract strings via CALIBRATION_COPY_KEYS in calibration-copy.ts (no i18n framework in-repo yet).
// Export payload is server-only; it is not attached to client Sentry breadcrumbs.

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { RATE_LIMITS, getClientIpFromHeaders, rateLimitCheck } from "@/lib/rate-limit";
import { getFeatureFlags } from "@/lib/feature-flags";
import { stripPrototypePollutionKeys } from "@/lib/security/strip-prototype-pollution";
import {
  coreFallbackV6Patch,
  finalizeRecommendation,
  recommendationToV6Patch,
} from "@/lib/onboarding/calibration-map";
import {
  calibrationAnswersOptionalSchema,
  calibrationAnswersRequiredSchema,
} from "@/lib/onboarding/calibration-zod";
import {
  ONBOARDING_CALIBRATION_JSON_VERSION,
  type CalibrationAnswersOptional,
  type CalibrationAnswersRequired,
  type CalibrationAppliedSnapshot,
  type CalibrationHistoryEntry,
  type OnboardingCalibrationState,
  parseOnboardingCalibration,
} from "@/lib/onboarding/calibration-types";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { getV6OrgSettingsJson, mergeV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { applyWorkspaceProductTransitionSideEffects } from "@/lib/product-surface/workspace-transition";
import {
  applyBlockingCalibrationMinimalSkip,
  safeSuppressNotificationTypesForModeDowngradeCalibration,
} from "@/lib/onboarding/calibration-blocking-minimal";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

/**
 * onboarding spec §17.3 / §19 — after V6 or workflow policy changes, invalidate the same surfaces as
 * product settings (`updateWorkspaceProductSurfaceForm`, `resetWorkspaceProductSurfaceDefaultsForm`).
 * Paths: `/dashboard`, `/more`, `/settings`, `/settings/product`, `/onboarding/calibration` (not `/settings/operations`).
 * Default landing path validity is enforced in {@link recommendationToV6Patch} / merge, not here.
 */
function revalidateCalibrationSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/more");
  revalidatePath("/settings");
  revalidatePath("/settings/product");
  revalidatePath("/onboarding/calibration");
}

const CALIBRATION_RATE_LIMIT_MSG = "Too many requests. Try again shortly.";

const EXPORT_ONBOARDING_CALIBRATION_JSON_MAX_BYTES = 512 * 1024;

/** Returns rate-limit message when blocked; otherwise null. */
async function rateLimitOnboardingCalibration(
  userId: string,
  bucket: "mutation" | "preview" | "export"
): Promise<string | null> {
  const ip = await getClientIpFromHeaders();
  const key =
    bucket === "mutation"
      ? `onboarding-calibration:mut:${userId}:${ip}`
      : bucket === "preview"
        ? `onboarding-calibration:preview:${userId}:${ip}`
        : `onboarding-calibration:export:${userId}:${ip}`;
  const cfg =
    bucket === "mutation"
      ? RATE_LIMITS.onboardingCalibrationMutation
      : bucket === "preview"
        ? RATE_LIMITS.onboardingCalibrationPreview
        : RATE_LIMITS.onboardingCalibrationExport;
  const hit = await rateLimitCheck(key, cfg);
  if (!hit.ok) return CALIBRATION_RATE_LIMIT_MSG;
  return null;
}

function hashAnswersShort(answers: CalibrationAnswersRequired): string {
  return createHash("sha256")
    .update(JSON.stringify(answers))
    .digest("hex")
    .slice(0, 16);
}

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

const partialAnswersSchema = z
  .object({
    answers_required: calibrationAnswersRequiredSchema.partial().optional(),
    answers_optional: calibrationAnswersOptionalSchema.nullish(),
  })
  .strict();

const previewPayloadSchema = z
  .object({
    answers_required: calibrationAnswersRequiredSchema,
    answers_optional: calibrationAnswersOptionalSchema.nullish(),
  })
  .strict();

export type CalibrationActionResult =
  | { ok: true; fallback?: true }
  | { ok: false; error: string };

export async function previewCalibrationRecommendation(
  input: unknown
): Promise<
  { ok: true; recommendation: ReturnType<typeof finalizeRecommendation> } | { ok: false; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "preview");
  if (limited) return { ok: false, error: limited };
  const raw = typeof input === "object" && input !== null ? stripPrototypePollutionKeys(input as never) : {};
  const parsed = previewPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid questionnaire payload." };
  const flags = getFeatureFlags();
  const rec = finalizeRecommendation(parsed.data.answers_required, flags, parsed.data.answers_optional ?? undefined);
  return { ok: true, recommendation: rec };
}

export async function recordQuestionnaireStarted(): Promise<CalibrationActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "mutation");
  if (limited) return { ok: false, error: limited };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal?.blocking_required) return { ok: true };
  if (prevCal.status !== "pending" && prevCal.status !== "in_progress") return { ok: true };
  const started = prevCal.questionnaire_started_at ?? nowIso();
  const nextCal = baseCalibrationFrom(prevCal, {
    status: "in_progress",
    questionnaire_started_at: started,
  });
  const { error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
    onboarding_calibration: nextCal,
  });
  if (error) return { ok: false, error: error.message };
  try {
    const { data: existingStart } = await ctx.admin
      .from("audit_events")
      .select("id")
      .eq("organization_id", ctx.orgId)
      .eq("action", "onboarding.questionnaire_started")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!existingStart) {
      const { error: auditErr } = await ctx.admin.from("audit_events").insert({
        organization_id: ctx.orgId,
        contract_id: null,
        user_id: ctx.user.id,
        action: "onboarding.questionnaire_started",
        details: { source: "wizard" },
      });
      if (auditErr) console.error("[onboarding-calibration] audit insert error", auditErr.message);
    }
  } catch (error) {
    console.error("[onboarding-calibration] questionnaire start audit failed", error);
  }
  revalidateCalibrationSurfaces();
  return { ok: true };
}

export async function saveQuestionnaireProgress(input: unknown): Promise<CalibrationActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "mutation");
  if (limited) return { ok: false, error: limited };
  const raw = typeof input === "object" && input !== null ? stripPrototypePollutionKeys(input as never) : {};
  const parsed = partialAnswersSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid progress payload." };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal) return { ok: false, error: "Calibration is not available for this workspace." };
  const canEdit =
    prevCal.blocking_required ||
    (!prevCal.blocking_required && prevCal.status === "in_progress");
  if (!canEdit) return { ok: false, error: "Questionnaire is not editable." };
  // Spec 23: concurrent edits use the same merge helper as product settings; last-write-wins on org JSON.
  const mergedRequired: Partial<CalibrationAnswersRequired> = {
    ...(prevCal.answers_required ?? {}),
    ...(parsed.data.answers_required ?? {}),
  };
  const mergedOptional: CalibrationAnswersOptional = {
    ...(prevCal.answers_optional ?? {}),
    ...(parsed.data.answers_optional ?? {}),
  };
  const nextCal = baseCalibrationFrom(prevCal, {
    status: prevCal.status === "pending" ? "in_progress" : prevCal.status,
    answers_required: Object.keys(mergedRequired).length > 0 ? mergedRequired : undefined,
    answers_optional: Object.keys(mergedOptional).length > 0 ? mergedOptional : undefined,
  });
  const { error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
    onboarding_calibration: nextCal,
  });
  if (error) return { ok: false, error: error.message };
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.onboarding_progressed",
    details: { surface: "questionnaire", step: "save_progress" },
  });
  revalidateCalibrationSurfaces();
  return { ok: true };
}

export async function startRecalibrationFromSettingsForm(): Promise<void> {
  const r = await beginRecalibration();
  if (!r.ok) redirect("/settings/product");
  redirect("/onboarding/calibration");
}

export async function beginRecalibration(): Promise<CalibrationActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "mutation");
  if (limited) return { ok: false, error: limited };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal) return { ok: false, error: "Calibration is not configured." };
  if (prevCal.status !== "completed" && prevCal.status !== "skipped") {
    return { ok: false, error: "Recalibration is only allowed from completed or skipped states." };
  }
  const nextCal = baseCalibrationFrom(prevCal, {
    status: "in_progress",
    questionnaire_started_at: nowIso(),
  });
  const { error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
    onboarding_calibration: nextCal,
  });
  if (error) return { ok: false, error: error.message };
  try {
    const { error: auditErr } = await ctx.admin.from("audit_events").insert({
      organization_id: ctx.orgId,
      contract_id: null,
      user_id: ctx.user.id,
      action: "onboarding.recalibration_run",
      details: { source: "settings" },
    });
    if (auditErr) console.error("[onboarding-calibration] audit insert error", auditErr.message);
  } catch (error) {
    console.error("[onboarding-calibration] recalibration audit insert threw", error);
  }
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.onboarding_progressed",
    details: { surface: "recalibration" },
  });
  revalidateCalibrationSurfaces();
  return { ok: true };
}

function buildAppliedSnapshot(
  merged: Awaited<ReturnType<typeof getV6OrgSettingsJson>>,
  userId: string
): CalibrationAppliedSnapshot {
  return {
    applied_at: nowIso(),
    applied_by_user_id: userId,
    applied_workspace_mode: parseWorkspaceMode(merged),
    advanced_modules_hidden: merged.advanced_modules_hidden ?? [],
    assurance_modules_hidden: merged.assurance_modules_hidden ?? [],
    utility_modules_hidden: merged.utility_modules_hidden ?? [],
    home_hidden_sections: merged.home_hidden_sections ?? [],
    search_scope: merged.search_scope ?? "match_mode",
    default_landing_path: merged.default_landing_path ?? null,
  };
}

async function insertProductSurfaceAudit(input: {
  admin: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>["admin"];
  orgId: string;
  userId: string;
  prevV6: Awaited<ReturnType<typeof getV6OrgSettingsJson>>;
  merged: Awaited<ReturnType<typeof getV6OrgSettingsJson>>;
  source: string;
  transition: Awaited<ReturnType<typeof applyWorkspaceProductTransitionSideEffects>>;
}) {
  const { admin, orgId, userId, prevV6, merged, source, transition } = input;
  const prevMode = parseWorkspaceMode(prevV6);
  try {
    const { error } = await admin.from("audit_events").insert({
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
    if (error) console.error("[onboarding-calibration] product surface audit insert error", error.message);
  } catch (error) {
    console.error("[onboarding-calibration] product surface audit insert threw", error);
  }
}

async function safeApplyWorkspaceProductTransitionSideEffects(
  input: Parameters<typeof applyWorkspaceProductTransitionSideEffects>[0]
): Promise<Awaited<ReturnType<typeof applyWorkspaceProductTransitionSideEffects>>> {
  try {
    return await applyWorkspaceProductTransitionSideEffects(input);
  } catch (error) {
    console.error("[onboarding-calibration] transition side effects failed", error);
    return { autoBlockedNotificationTypes: [], suppressedSubscriptionCount: 0 };
  }
}

export async function completeQuestionnaireAcceptRecommendation(
  input: unknown
): Promise<CalibrationActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "mutation");
  if (limited) return { ok: false, error: limited };
  const raw = typeof input === "object" && input !== null ? stripPrototypePollutionKeys(input as never) : {};
  const parsed = previewPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid questionnaire payload." };

  let prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  let prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal) return { ok: false, error: "Calibration is not available." };
  let allowComplete =
    (prevCal.blocking_required && (prevCal.status === "pending" || prevCal.status === "in_progress")) ||
    (!prevCal.blocking_required && prevCal.status === "in_progress");
  if (!allowComplete) return { ok: false, error: "Questionnaire is already finished." };

  prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal) return { ok: false, error: "Calibration is not available." };
  if (prevCal.status === "completed") {
    revalidateCalibrationSurfaces();
    return { ok: true };
  }
  allowComplete =
    (prevCal.blocking_required && (prevCal.status === "pending" || prevCal.status === "in_progress")) ||
    (!prevCal.blocking_required && prevCal.status === "in_progress");
  if (!allowComplete) return { ok: false, error: "Questionnaire is already finished." };

  const prevMode = parseWorkspaceMode(prevV6);
  const flags = getFeatureFlags();
  const rec = finalizeRecommendation(parsed.data.answers_required, flags, parsed.data.answers_optional ?? undefined);
  const v6Patch = recommendationToV6Patch(rec);
  const answerHash = hashAnswersShort(parsed.data.answers_required);

  const completedAt = nowIso();
  let history: CalibrationHistoryEntry[] = [...(prevCal.history ?? [])];
  history.push({
    at: completedAt,
    actor_user_id: ctx.user.id,
    prior_mode: prevMode,
    next_mode: rec.recommended_workspace_mode,
    choice: "accept",
  });
  if (history.length > 32) history = history.slice(-32);

  const nextCalWithoutSnapshot: OnboardingCalibrationState = baseCalibrationFrom(prevCal, {
    blocking_required: false,
    status: "completed",
    questionnaire_completed_at: completedAt,
    answers_required: parsed.data.answers_required,
    answers_optional: parsed.data.answers_optional ?? undefined,
    last_recommendation: rec,
    history,
  });

  try {
    // §24.2 — single organizations.update per step: surface patch + onboarding_calibration subtree together.
    const { data: merged, error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
      ...v6Patch,
      onboarding_calibration: nextCalWithoutSnapshot,
    });
    if (error || !merged) throw new Error(error?.message ?? "merge failed");

    const snapshot = buildAppliedSnapshot(merged, ctx.user.id);
    const parsedCal = parseOnboardingCalibration(merged.onboarding_calibration);
    const finalCal: OnboardingCalibrationState = baseCalibrationFrom(parsedCal ?? nextCalWithoutSnapshot, {
      last_applied: snapshot,
    });

    const { data: merged2, error: err2 } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
      onboarding_calibration: finalCal,
    });
    if (err2 || !merged2) throw new Error(err2?.message ?? "merge calibration snapshot failed");

    const nextMode = parseWorkspaceMode(merged2);
    const transition = await safeApplyWorkspaceProductTransitionSideEffects({
      admin: ctx.admin,
      orgId: ctx.orgId,
      userId: ctx.user.id,
      prevMode,
      nextMode,
    });
    // §18.2 / §24.2 — org JSON first; workflow upsert is best-effort (org state remains authoritative).
    await safeSuppressNotificationTypesForModeDowngradeCalibration({
      admin: ctx.admin,
      orgId: ctx.orgId,
      mode: nextMode,
    });

    await insertProductSurfaceAudit({
      admin: ctx.admin,
      orgId: ctx.orgId,
      userId: ctx.user.id,
      prevV6,
      merged: merged2,
      source: "onboarding_calibration",
      transition,
    });

    try {
      const { error: auditErr } = await ctx.admin.from("audit_events").insert([
        {
          organization_id: ctx.orgId,
          contract_id: null,
          user_id: ctx.user.id,
          action: "onboarding.recommendation_generated",
          details: {
            recommended_mode: rec.recommended_workspace_mode,
            answers_hash: answerHash,
          },
        },
        {
          organization_id: ctx.orgId,
          contract_id: null,
          user_id: ctx.user.id,
          action: "onboarding.recommendation_accepted",
          details: { next_mode: rec.recommended_workspace_mode },
        },
        {
          organization_id: ctx.orgId,
          contract_id: null,
          user_id: ctx.user.id,
          action: "onboarding.questionnaire_completed",
          details: { choice: "accept" },
        },
        {
          organization_id: ctx.orgId,
          contract_id: null,
          user_id: ctx.user.id,
          action: "onboarding.calibration_applied",
          details: {
            prev_workspace_mode: prevMode,
            next_workspace_mode: nextMode,
            prev_advanced_hidden: prevV6.advanced_modules_hidden ?? [],
            next_advanced_hidden: merged2.advanced_modules_hidden ?? [],
            prev_assurance_hidden: prevV6.assurance_modules_hidden ?? [],
            next_assurance_hidden: merged2.assurance_modules_hidden ?? [],
            prev_home_hidden: prevV6.home_hidden_sections ?? [],
            next_home_hidden: merged2.home_hidden_sections ?? [],
          },
        },
      ]);
      if (auditErr) console.error("[onboarding-calibration] audit insert error", auditErr.message);
    } catch (error) {
      console.error("[onboarding-calibration] audit insert threw", error);
    }
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.user.id,
      action: "product.v9.onboarding_completed",
      details: { path: "accept_recommendation" },
    });
  } catch {
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.user.id,
      action: "product.v9.onboarding_failed",
      details: { phase: "accept_recommendation" },
    });
    Sentry.captureMessage("onboarding.calibration_apply_failed", {
      level: "error",
      extra: { orgId: ctx.orgId, answers_hash: answerHash },
    });
    const fallback = coreFallbackV6Patch();
    const failCal = baseCalibrationFrom(prevCal, {
      blocking_required: false,
      status: "skipped",
      last_skipped_at: completedAt,
      history: [
        ...(prevCal.history ?? []),
        {
          at: completedAt,
          actor_user_id: ctx.user.id,
          prior_mode: prevMode,
          next_mode: "core" as WorkspaceProductMode,
          choice: "skip" as const,
        } satisfies CalibrationHistoryEntry,
      ].slice(-32),
    });
    const { error: fbErr } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
      ...fallback,
      onboarding_calibration: failCal,
    });
    if (fbErr) return { ok: false, error: fbErr.message };
    await safeSuppressNotificationTypesForModeDowngradeCalibration({
      admin: ctx.admin,
      orgId: ctx.orgId,
      mode: "core",
    });
    try {
      const { error: auditErr } = await ctx.admin.from("audit_events").insert({
        organization_id: ctx.orgId,
        contract_id: null,
        user_id: ctx.user.id,
        action: "onboarding.calibration_error",
        details: { phase: "accept_recommendation", answers_hash: answerHash },
      });
      if (auditErr) console.error("[onboarding-calibration] audit insert error", auditErr.message);
    } catch (error) {
      console.error("[onboarding-calibration] fallback audit insert threw", error);
    }
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.user.id,
      action: "product.v9.onboarding_recovered",
      details: { path: "accept_recommendation_fallback_core" },
    });
    revalidateCalibrationSurfaces();
    return { ok: true, fallback: true as const };
  }

  revalidateCalibrationSurfaces();
  return { ok: true };
}

export async function completeQuestionnaireSimplerSetup(): Promise<CalibrationActionResult> {
  return completeMinimalPath("simpler");
}

export async function skipQuestionnaireExplicitMinimal(): Promise<CalibrationActionResult> {
  return completeMinimalPath("skip");
}

async function completeMinimalPath(
  choice: "simpler" | "skip"
): Promise<CalibrationActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "mutation");
  if (limited) return { ok: false, error: limited };
  let prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  let prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal?.blocking_required) return { ok: false, error: "Minimal path is only for first-run blocking." };
  if (prevCal.status !== "pending" && prevCal.status !== "in_progress") {
    return { ok: false, error: "Questionnaire is already finished." };
  }
  prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (prevCal?.status === "completed" || prevCal?.status === "skipped") {
    revalidateCalibrationSurfaces();
    return { ok: true };
  }
  if (!prevCal?.blocking_required) return { ok: false, error: "Minimal path is only for first-run blocking." };
  if (prevCal.status !== "pending" && prevCal.status !== "in_progress") {
    return { ok: false, error: "Questionnaire is already finished." };
  }
  const applied = await applyBlockingCalibrationMinimalSkip({
    admin: ctx.admin,
    orgId: ctx.orgId,
    actorUserId: ctx.user.id,
    prevV6,
    prevCal,
    choice,
  });
  if (!applied.ok) return applied;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.onboarding_completed",
    details: { path: choice === "simpler" ? "minimal_simpler" : "minimal_skip" },
  });
  revalidateCalibrationSurfaces();
  return { ok: true };
}

export async function completeQuestionnaireOpenAdvancedSettings(): Promise<CalibrationActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "mutation");
  if (limited) return { ok: false, error: limited };
  let prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  let prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal?.blocking_required) return { ok: false, error: "This path is only for first-run blocking." };
  if (prevCal.status !== "pending" && prevCal.status !== "in_progress") {
    return { ok: false, error: "Questionnaire is already finished." };
  }
  prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (prevCal?.status === "completed") {
    revalidateCalibrationSurfaces();
    return { ok: true };
  }
  if (!prevCal?.blocking_required) return { ok: false, error: "This path is only for first-run blocking." };
  if (prevCal.status !== "pending" && prevCal.status !== "in_progress") {
    return { ok: false, error: "Questionnaire is already finished." };
  }
  const completedAt = nowIso();
  const prevMode = parseWorkspaceMode(prevV6);
  const nextCal = baseCalibrationFrom(prevCal, {
    blocking_required: false,
    status: "completed",
    questionnaire_completed_at: completedAt,
    history: [
      ...(prevCal.history ?? []),
      {
        at: completedAt,
        actor_user_id: ctx.user.id,
        prior_mode: prevMode,
        next_mode: prevMode,
        choice: "settings" as const,
      } satisfies CalibrationHistoryEntry,
    ].slice(-32),
  });
  const { error } = await mergeV6OrgSettingsJson(ctx.admin, ctx.orgId, {
    onboarding_calibration: nextCal,
  });
  if (error) return { ok: false, error: error.message };
  try {
    const { error: auditErr } = await ctx.admin.from("audit_events").insert([
      {
        organization_id: ctx.orgId,
        contract_id: null,
        user_id: ctx.user.id,
        action: "onboarding.recommendation_overridden",
        details: { destination: "/settings/product" },
      },
      {
        organization_id: ctx.orgId,
        contract_id: null,
        user_id: ctx.user.id,
        action: "onboarding.questionnaire_completed",
        details: { choice: "settings" },
      },
    ]);
    if (auditErr) console.error("[onboarding-calibration] audit insert error", auditErr.message);
  } catch (error) {
    console.error("[onboarding-calibration] settings path audit insert threw", error);
  }
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.onboarding_completed",
    details: { path: "open_advanced_settings" },
  });
  revalidateCalibrationSurfaces();
  return { ok: true };
}

export async function exportOnboardingCalibrationSupportJson(
  input?: unknown
): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  if (input !== undefined) {
    if (typeof input !== "object" || input === null) {
      return { ok: false, error: "Invalid input." };
    }
    const raw = stripPrototypePollutionKeys(input as never);
    if (Object.keys(raw).length > 0) {
      return { ok: false, error: "Invalid input." };
    }
  }
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "admin") return { ok: false, error: "Unauthorized." };
  const limited = await rateLimitOnboardingCalibration(ctx.user.id, "export");
  if (limited) return { ok: false, error: limited };
  const prevV6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
  if (!prevCal) return { ok: false, error: "No calibration record." };
  const orgFingerprint = createHash("sha256").update(ctx.orgId).digest("hex").slice(0, 8);
  const envelope = {
    export_version: 1 as const,
    exported_at: new Date().toISOString(),
    organization_fingerprint: orgFingerprint,
    onboarding_calibration: prevCal,
  };
  const json = JSON.stringify(envelope);
  if (json.length > EXPORT_ONBOARDING_CALIBRATION_JSON_MAX_BYTES) {
    return { ok: false, error: "Export too large." };
  }
  const { error: auditErr } = await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    contract_id: null,
    user_id: ctx.user.id,
    action: "onboarding.calibration_support_export",
    details: { version: prevCal.version, status: prevCal.status },
  });
  if (auditErr) console.error("[onboarding-calibration] audit insert error", auditErr.message);
  return { ok: true, json };
}
