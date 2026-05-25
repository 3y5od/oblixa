import type { createAdminClient } from "@/lib/supabase/server";
import { redactSensitiveLogString } from "@/lib/observability/log-redaction";
import { redactPersistenceString } from "@/lib/security/persistence-redaction";
import { createV10ObjectiveTelemetryPayload } from "@/lib/objective-telemetry";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

/** Allowlisted v9 §28.1–28.2 product/reliability signals (non-PII payloads only). */
export const PRODUCT_TELEMETRY_ACTIONS = [
  "product.v10.activation_completed",
  "product.v10.first_work_item_generated",
  "product.v10.work_item_completed",
  "product.v10.renewal_posture_computed",
  "product.v10.evidence_follow_up_scheduled",
  "product.v10.evidence_request_created",
  "product.v10.evidence_submitted",
  "product.v10.report_run_completed",
  "product.v10.export_job_completed",
  "product.v10.command_palette_opened",
  "product.v10.command_palette_recovered",
  "product.v10.command_palette_result_selected",
  "product.v10.command_palette_zero_result",
  "product.v10.empty_state_cta_clicked",
  "product.v10.failed_job_retry_succeeded",
  "product.v10.release_check_recorded",
  "product.v10.review_queue_cleared",
  "product.v10.evidence_review_decision_recorded",
  "product.v10.approval_decision_recorded",
  "product.v10.approval_sla_breached",
  "product.v10.exception_resolution_recorded",
  "product.v10.renewal_checkpoint_completed",
  "product.v10.renewal_checkpoint_reopened",
  "product.v10.renewal_decision_packet_generated",
  "product.v10.import_extraction_failure_rate_sampled",
  "product.v10.contract_record_opened",
  "product.v10.contract_record_trust_viewed",
  "product.v10.field_review_completed",
  "product.v10.review_save_next_used",
  "product.v9.bulk_owner_assigned",
  "product.v9.onboarding_progressed",
  "product.v9.onboarding_completed",
  "product.v9.onboarding_recovered",
  "product.v9.onboarding_failed",
  "product.v9.first_contract_created",
  "product.v9.cmdk_palette_opened",
  "product.v9.cmdk_result_selected",
  "product.v9.cmdk_zero_results",
  "product.v9.import_started",
  "product.v9.import_completed",
  "product.v9.import_partially_completed",
  "product.v9.import_failed",
  "product.v9.import_retry_started",
  "product.v9.export_started",
  "product.v9.export_completed",
  "product.v9.export_partially_completed",
  "product.v9.export_failed",
  "product.v9.extraction_started",
  "product.v9.extraction_succeeded",
  "product.v9.extraction_failed",
  "product.v9.reminder_delivered",
  "product.v9.reminder_suppressed",
  "product.v9.reminder_failed",
  "product.v9.reminder_retried",
  "product.v9.review_started",
  "product.v9.review_item_approved",
  "product.v9.review_item_edited",
  "product.v9.review_save_next_used",
  "product.v9.first_review_completed",
  "product.v9.work_action_attempted",
  "product.v9.work_action_succeeded",
  "product.v9.work_action_failed",
  "product.v9.first_visible_work_item",
  "product.v9.renewal_action_taken",
  "product.v9.renewal_blocker_encountered",
  "product.v9.evidence_requested",
  "product.v9.evidence_submitted",
  "product.v9.evidence_rejected",
  "product.v9.evidence_resubmitted",
  "product.v9.evidence_review_decision_recorded",
  "product.v9.page_load_measured",
  "product.v9.visible_mutation_error",
] as const;

export type ProductTelemetryLegacyAction = (typeof PRODUCT_TELEMETRY_ACTIONS)[number];
export type ProductTelemetryNeutralAction = `product.${string}`;
export type ProductTelemetryAction = ProductTelemetryLegacyAction | ProductTelemetryNeutralAction;

function neutralAliasForLegacyAction(action: ProductTelemetryLegacyAction): ProductTelemetryNeutralAction {
  const match = /^product\.v(\d+)\.(.+)$/u.exec(action);
  if (!match) return action as ProductTelemetryNeutralAction;
  const [, version, suffix] = match;
  return (version === "10" ? `product.${suffix}` : `product.compat.${suffix}`) as ProductTelemetryNeutralAction;
}

export const PRODUCT_TELEMETRY_NEUTRAL_ACTION_ALIASES = Object.freeze(
  Object.fromEntries(PRODUCT_TELEMETRY_ACTIONS.map((action) => [neutralAliasForLegacyAction(action), action]))
) as Readonly<Record<ProductTelemetryNeutralAction, ProductTelemetryLegacyAction>>;

export const V10_TELEMETRY_COMPATIBILITY_BRIDGES = {
  "product.v9.evidence_requested": "product.v10.evidence_request_created",
  "product.v9.evidence_submitted": "product.v10.evidence_submitted",
  "product.v9.evidence_review_decision_recorded": "product.v10.evidence_review_decision_recorded",
  "product.v9.cmdk_palette_opened": "product.v10.command_palette_opened",
  "product.v9.cmdk_result_selected": "product.v10.command_palette_result_selected",
  "product.v9.cmdk_zero_results": "product.v10.command_palette_zero_result",
  "product.v9.work_action_succeeded": "product.v10.work_item_completed",
  "product.v9.review_save_next_used": "product.v10.review_save_next_used",
} as const satisfies Partial<Record<ProductTelemetryLegacyAction, ProductTelemetryLegacyAction>>;

export const V10_TELEMETRY_EVENT_EVIDENCE_EXCEPTIONS: Partial<Record<ProductTelemetryLegacyAction, string>> = {
  "product.v10.first_work_item_generated": "Generated from read-model activation evidence until the async job worker emits runtime telemetry.",
  "product.v10.renewal_posture_computed": "Computed during read-model refresh and promoted through release evidence.",
  "product.v10.evidence_follow_up_scheduled": "Cron/provider delivery evidence is release-environment gated.",
  "product.v10.report_run_completed": "Report worker runtime telemetry is validated through job visibility and release evidence.",
  "product.v10.export_job_completed": "Export worker runtime telemetry is validated through job visibility and release evidence.",
  "product.v10.command_palette_result_selected": "Client-side selection telemetry is browser/E2E gated.",
  "product.v10.failed_job_retry_succeeded": "Retry success telemetry is job-worker gated.",
  "product.v10.release_check_recorded": "Release-owner evidence is generated by release checks outside product runtime.",
} as const;

/** Soft cap for JSON-serialized `details` stored on `audit_events` (telemetry only). */
export const PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES = 6000;
const V10_TELEMETRY_SAFE_URL_PARAMS = new Set(["tab", "lens", "state", "mode", "result"]);
const V10_TELEMETRY_FORBIDDEN_DETAIL_KEY_RE =
  /(^|_)(email|phone|address|token|secret|password|note|comment|raw_contract_text|contract_text|signed_url|private_url|file_url|file_name|oauth_code|authorization|api_key|webhook_secret)(_|$)/i;

export function sanitizeV10TelemetryUrl(value: string): string {
  const trimmed = value.trim();
  if (!/^(https?:\/\/|\/)/i.test(trimmed)) return value;
  try {
    const parsed = new URL(trimmed, "https://oblixa.local");
    const safeParams = new URLSearchParams();
    for (const [key, paramValue] of parsed.searchParams.entries()) {
      if (V10_TELEMETRY_SAFE_URL_PARAMS.has(key)) safeParams.set(key, paramValue.slice(0, 80));
    }
    const query = safeParams.toString();
    return `${parsed.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return "[redacted_url]";
  }
}

export function clampProductTelemetryDetails(
  details: Record<string, string | number | boolean | null> | undefined
): Record<string, string | number | boolean | null> {
  if (!details) return {};
  const out: Record<string, string | number | boolean | null> = {};
  const keys = Object.keys(details).slice(0, 48);
  let droppedFieldCount = 0;
  for (const k of keys) {
    if (V10_TELEMETRY_FORBIDDEN_DETAIL_KEY_RE.test(k)) {
      droppedFieldCount += 1;
      continue;
    }
    const v = details[k];
    if (v === undefined) continue;
    if (typeof v === "string") {
      const urlSafe = sanitizeV10TelemetryUrl(v);
      out[k] = redactPersistenceString(redactSensitiveLogString(urlSafe, 800), 800);
    } else {
      out[k] = v;
    }
  }
  if (droppedFieldCount > 0) out.dropped_field_count = Number(out.dropped_field_count ?? 0) + droppedFieldCount;
  let json = JSON.stringify(out);
  if (json.length <= PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES) return out;
  const trimmed: Record<string, string | number | boolean | null> = {};
  for (const k of keys) {
    trimmed[k] = typeof out[k] === "string" ? String(out[k]).slice(0, 120) : out[k];
  }
  json = JSON.stringify(trimmed);
  if (json.length <= PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES) return trimmed;
  return { truncated: true as const, keys: keys.slice(0, 12).join(",") };
}

/** Emit `action` at most once per organization (workspace-scoped milestone). */
export async function emitProductTelemetryIfFirstInOrganization(
  admin: Admin,
  input: {
    organizationId: string;
    userId: string | null;
    contractId?: string | null;
    action: ProductTelemetryAction;
    details?: Record<string, string | number | boolean | null>;
  }
): Promise<void> {
  const action = normalizeProductTelemetryAction(input.action);
  if (!action) return;
  const { count, error } = await admin
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("action", action);
  if (error || (count ?? 0) > 0) return;
  await emitProductTelemetryEvent(admin, { ...input, action });
}

/** Emit `action` at most once per organization + user. */
export async function emitProductTelemetryIfFirstForOrgUser(
  admin: Admin,
  input: {
    organizationId: string;
    userId: string;
    contractId?: string | null;
    action: ProductTelemetryAction;
    details?: Record<string, string | number | boolean | null>;
  }
): Promise<void> {
  const action = normalizeProductTelemetryAction(input.action);
  if (!action) return;
  const { count, error } = await admin
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("action", action);
  if (error || (count ?? 0) > 0) return;
  await emitProductTelemetryEvent(admin, { ...input, action });
}

export type WorkTelemetrySurface = "task" | "approval" | "obligation";

export async function emitWorkActionTelemetry(
  admin: Admin,
  ctx: { organizationId: string; userId: string; contractId: string },
  surface: WorkTelemetrySurface,
  intent: string,
  outcome: "attempted" | "succeeded" | "failed"
): Promise<void> {
  const action: ProductTelemetryAction =
    outcome === "attempted"
      ? "product.v9.work_action_attempted"
      : outcome === "succeeded"
        ? "product.v9.work_action_succeeded"
        : "product.v9.work_action_failed";
  await emitProductTelemetryEvent(admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    contractId: ctx.contractId,
    action,
    details: { surface, intent },
  });
}

export async function emitVisibleMutationErrorTelemetry(
  admin: Admin,
  input: {
    organizationId: string;
    userId: string | null;
    contractId?: string | null;
    surface: string;
    mutation: string;
    code?: string | null;
  }
): Promise<void> {
  await emitProductTelemetryEvent(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    contractId: input.contractId ?? null,
    action: "product.v9.visible_mutation_error",
    details: {
      surface: input.surface,
      mutation: input.mutation,
      code: input.code ?? null,
    },
  });
}

export async function emitV10ObjectiveTelemetryEvent(
  admin: Admin,
  input: {
    organizationId: string;
    userId: string | null;
    contractId?: string | null;
    objectiveKey: string;
    action: ProductTelemetryAction;
    details: Record<string, string | number | boolean | null>;
  }
): Promise<void> {
  const { payload, droppedFields } = createV10ObjectiveTelemetryPayload(input.objectiveKey, input.details);
  await emitProductTelemetryEvent(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    contractId: input.contractId ?? null,
    action: input.action,
    details: {
      ...payload,
      dropped_field_count: droppedFields.length,
    },
  });
}

function isLegacyAction(action: string): action is ProductTelemetryLegacyAction {
  return (PRODUCT_TELEMETRY_ACTIONS as readonly string[]).includes(action);
}

export function normalizeProductTelemetryAction(action: string): ProductTelemetryLegacyAction | null {
  if (isLegacyAction(action)) return action;
  return PRODUCT_TELEMETRY_NEUTRAL_ACTION_ALIASES[action as ProductTelemetryNeutralAction] ?? null;
}

/**
 * Inserts a single `audit_events` row when `action` is allowlisted. Swallows errors
 * so telemetry never blocks primary workflows.
 */
export async function emitProductTelemetryEvent(
  admin: Admin,
  input: {
    organizationId: string;
    userId: string | null;
    contractId?: string | null;
    action: string;
    details?: Record<string, string | number | boolean | null>;
  }
): Promise<boolean> {
  const action = normalizeProductTelemetryAction(input.action);
  if (!action) return false;
  try {
    const details = clampProductTelemetryDetails(input.details);
    const { error } = await admin.from("audit_events").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      contract_id: input.contractId ?? null,
      action,
      details,
    });
    if (error) {
      console.error("[product-telemetry] insert failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[product-telemetry] insert threw:", e);
    return false;
  }
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { emitV10ObjectiveTelemetryEvent as emitObjectiveTelemetryEvent };
export { sanitizeV10TelemetryUrl as sanitizeTelemetryUrl };
export { V10_TELEMETRY_COMPATIBILITY_BRIDGES as TELEMETRY_COMPATIBILITY_BRIDGES };
export { V10_TELEMETRY_EVENT_EVIDENCE_EXCEPTIONS as TELEMETRY_EVENT_EVIDENCE_EXCEPTIONS };
// End version-name compatibility aliases.
