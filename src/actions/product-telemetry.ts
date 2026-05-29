"use server";

import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { getClientIpFromHeaders, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

const corePathSchema = z
  .string()
  .max(220)
  .regex(/^\/[A-Za-z0-9/_\-?#.&=[\]%+]*$/);

const hrefSchema = z.string().max(280);
const cmdkSearchSourceSchema = z.enum(["overlay", "page"]);

async function gateV9Telemetry(userId: string): Promise<boolean> {
  const ip = await getClientIpFromHeaders();
  const hit = await rateLimitCheck(`v9-product-telemetry:${userId}:${ip}`, RATE_LIMITS.productV9Telemetry);
  return hit.ok;
}

async function gateProductTelemetry(userId: string): Promise<boolean> {
  return gateV9Telemetry(userId);
}

/** Optional discriminator for the search surface that emitted the event.
 *  Both the overlay and the dedicated /search page share telemetry names
 *  (contracts) but can now be distinguished downstream. Defaults to "overlay"
 *  for back-compat with callers that don't pass a source. */
export type CmdkSearchSource = "overlay" | "page";

/** Cmd-K / palette open — rate-limit client-side before calling; server also rate-limits. */
export async function emitCmdkPaletteOpenedTelemetry(
  input: { source?: CmdkSearchSource } = {}
) {
  const sourceResult = cmdkSearchSourceSchema.safeParse(input.source ?? "overlay");
  if (!sourceResult.success) return;
  const source = sourceResult.data;
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (!(await gateProductTelemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.cmdk_palette_opened",
    details: { surface: "cmdk", source },
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v10.command_palette_opened",
    details: {
      event: "opened",
      surface: "command_palette",
      source,
    },
  });
}

export async function emitCmdkResultSelectedTelemetry(input: {
  href: string;
  queryLen: number;
  source?: CmdkSearchSource;
}) {
  const source: CmdkSearchSource = input.source ?? "overlay";
  const ctx = await getAuthContext();
  if (!ctx) return;
  const href = hrefSchema.safeParse(input.href.trim());
  if (!href.success) return;
  if (!Number.isFinite(input.queryLen) || input.queryLen < 0 || input.queryLen > 500) return;
  if (!(await gateProductTelemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.cmdk_result_selected",
    details: { href: href.data, queryLen: Math.round(input.queryLen), source },
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v10.command_palette_result_selected",
    details: {
      event: "selected",
      route_template: href.data.split("?")[0] ?? href.data,
      queryLen: Math.round(input.queryLen),
      source,
    },
  });
}

export async function emitCmdkZeroResultsTelemetry(input: {
  queryLen?: number;
  q?: string;
  source?: CmdkSearchSource;
}) {
  const source: CmdkSearchSource = input.source ?? "overlay";
  const queryLen =
    typeof input.queryLen === "number"
      ? input.queryLen
      : typeof input.q === "string"
        ? input.q.length
        : 0;
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (!Number.isFinite(queryLen) || queryLen < 1 || queryLen > 500) return;
  if (!(await gateProductTelemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.cmdk_zero_results",
    details: { queryLen: Math.round(queryLen), source },
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v10.command_palette_zero_result",
    details: {
      event: "zero_results",
      zero_result: true,
      recovery_action: "open_contract_search",
      queryLen: Math.round(queryLen),
      source,
    },
  });
}

export async function emitCmdkSearchFailedTelemetry(input: { queryLen: number }) {
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (!Number.isFinite(input.queryLen) || input.queryLen < 1 || input.queryLen > 500) return;
  if (!(await gateProductTelemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v10.command_palette_recovered",
    details: {
      event: "search_failed",
      recovery_action: "retry_or_open_health",
      queryLen: Math.round(input.queryLen),
    },
  });
}

export async function emitReviewSaveNextUsedTelemetry() {
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (!(await gateProductTelemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.review_save_next_used",
    details: { surface: "review_queue" },
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v10.review_save_next_used",
    details: {
      surface: "review_queue",
      recovery_action: "save_and_next",
    },
  });
}

export async function emitV10EmptyStateCtaClickedTelemetry(input: {
  surface: string;
  section: string;
  sourceObject: string;
  actionLabel: string;
  href: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return;
  const href = hrefSchema.safeParse(input.href.trim());
  if (!href.success) return;
  if (!(await gateProductTelemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v10.empty_state_cta_clicked",
    details: {
      surface: input.surface.slice(0, 80),
      section: input.section.slice(0, 80),
      source_object: input.sourceObject.slice(0, 80),
      action_label: input.actionLabel.slice(0, 120),
      href: href.data,
    },
  });
}

export async function emitPageLoadMeasuredTelemetry(input: { path: string; durationMs: number }) {
  const ctx = await getAuthContext();
  if (!ctx) return;
  const path = corePathSchema.safeParse(input.path.trim());
  if (!path.success) return;
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0 || input.durationMs > 600_000) return;
  if (!(await gateV9Telemetry(ctx.user.id))) return;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.page_load_measured",
    details: { path: path.data, durationMs: Math.round(input.durationMs) },
  });
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { emitV10EmptyStateCtaClickedTelemetry as emitEmptyStateCtaClickedTelemetry };
// End version-name compatibility aliases.
