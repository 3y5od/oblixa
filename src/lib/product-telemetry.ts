import type { createAdminClient } from "@/lib/supabase/server";
import { redactEmailLikeSubstrings } from "@/lib/observability/log-redaction";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

/** Allowlisted v9 §28.1–28.2 product/reliability signals (non-PII payloads only). */
export const PRODUCT_TELEMETRY_ACTIONS = [
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

export type ProductTelemetryAction = (typeof PRODUCT_TELEMETRY_ACTIONS)[number];

/** Soft cap for JSON-serialized `details` stored on `audit_events` (telemetry only). */
export const PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES = 6000;

export function clampProductTelemetryDetails(
  details: Record<string, string | number | boolean | null> | undefined
): Record<string, string | number | boolean | null> {
  if (!details) return {};
  const out: Record<string, string | number | boolean | null> = {};
  const keys = Object.keys(details).slice(0, 48);
  for (const k of keys) {
    const v = details[k];
    if (v === undefined) continue;
    if (typeof v === "string") {
      const clipped = v.length > 800 ? `${v.slice(0, 797)}…` : v;
      out[k] = redactEmailLikeSubstrings(clipped, 800);
    } else {
      out[k] = v;
    }
  }
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
  const { count, error } = await admin
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("action", input.action);
  if (error || (count ?? 0) > 0) return;
  await emitProductTelemetryEvent(admin, input);
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
  const { count, error } = await admin
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("action", input.action);
  if (error || (count ?? 0) > 0) return;
  await emitProductTelemetryEvent(admin, input);
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

function isAllowlistedAction(action: string): action is ProductTelemetryAction {
  return (PRODUCT_TELEMETRY_ACTIONS as readonly string[]).includes(action);
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
): Promise<void> {
  if (!isAllowlistedAction(input.action)) return;
  try {
    const details = clampProductTelemetryDetails(input.details);
    const { error } = await admin.from("audit_events").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      contract_id: input.contractId ?? null,
      action: input.action,
      details,
    });
    if (error) {
      console.error("[product-telemetry] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[product-telemetry] insert threw:", e);
  }
}
