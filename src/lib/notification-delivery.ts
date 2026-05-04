import { createAdminClient } from "@/lib/supabase/server";
import { sendReminderEmail, sendReviewBoardPacketEmail, sendSavedViewSummaryEmail } from "@/lib/email";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const MAX_METADATA_BYTES = 12_000;
const MAX_RETRY_ROWS = 8;
const RETRY_PROCESS_CONCURRENCY = 5;

function limitString(value: string | null | undefined, maxLen: number): string {
  return String(value ?? "").slice(0, maxLen);
}

type RetryPayload =
  | {
      kind: "reminder_due";
      to: string;
      contractTitle: string;
      fieldName: string;
      fieldValue: string;
      daysUntil: number;
      contractUrl: string;
      sourceSnippet?: string | null;
    }
  | {
      kind: "saved_view_summary";
      to: string;
      viewName: string;
      appUrl: string;
      itemCount: number;
      workspacePath: string;
      sampleRows: Array<{ label: string; href: string; meta: string }>;
      openPixelUrl?: string | null;
      workspaceProductMode?: WorkspaceProductMode;
    }
  | {
      kind: "review_board_packet";
      to: string;
      subject: string;
      htmlBody: string;
    }
  | {
      kind: "slack_workflow";
      webhookUrl: string;
      title: string;
      body: string;
      channel?: string | null;
      username?: string | null;
      metadata?: Record<string, unknown>;
    };

function sanitizeRetryPayload(payload: RetryPayload | undefined | null): RetryPayload | null {
  if (!payload) return null;
  if (payload.kind === "reminder_due") {
    return {
      kind: "reminder_due",
      to: limitString(payload.to, 320),
      contractTitle: limitString(payload.contractTitle, 240),
      fieldName: limitString(payload.fieldName, 120),
      fieldValue: limitString(payload.fieldValue, 240),
      daysUntil: Math.max(0, Math.min(3650, Math.trunc(Number(payload.daysUntil) || 0))),
      contractUrl: limitString(payload.contractUrl, 1024),
      sourceSnippet: payload.sourceSnippet ? limitString(payload.sourceSnippet, 2000) : null,
    };
  }
  if (payload.kind === "saved_view_summary") {
    const mode = payload.workspaceProductMode;
    const safeMode: WorkspaceProductMode | undefined =
      mode === "core" || mode === "advanced" || mode === "assurance" ? mode : undefined;
    return {
      kind: "saved_view_summary",
      to: limitString(payload.to, 320),
      viewName: limitString(payload.viewName, 200),
      appUrl: limitString(payload.appUrl, 1024),
      itemCount: Math.max(0, Math.min(10_000, Math.trunc(Number(payload.itemCount) || 0))),
      workspacePath: limitString(payload.workspacePath, 1024),
      sampleRows: (payload.sampleRows ?? []).slice(0, MAX_RETRY_ROWS).map((row) => ({
        label: limitString(row.label, 200),
        href: limitString(row.href, 1024),
        meta: limitString(row.meta, 280),
      })),
      openPixelUrl: payload.openPixelUrl ? limitString(payload.openPixelUrl, 1024) : null,
      workspaceProductMode: safeMode,
    };
  }
  if (payload.kind === "review_board_packet") {
    return {
      kind: "review_board_packet",
      to: limitString(payload.to, 320),
      subject: limitString(payload.subject, 240),
      htmlBody: limitString(payload.htmlBody, 14_000),
    };
  }
  return {
    kind: "slack_workflow",
    webhookUrl: limitString(payload.webhookUrl, 1024),
    title: limitString(payload.title, 240),
    body: limitString(payload.body, 4000),
    channel: payload.channel ? limitString(payload.channel, 120) : null,
    username: payload.username ? limitString(payload.username, 120) : null,
    metadata: payload.metadata ?? {},
  };
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out = { ...(metadata ?? {}) };
  delete out.retry_payload;
  delete out.max_attempts;
  let encoded = "";
  try {
    encoded = JSON.stringify(out);
  } catch {
    return { metadata_truncated: true };
  }
  if (encoded.length <= MAX_METADATA_BYTES) return out;
  return { metadata_truncated: true };
}

function isTerminalDeliveryError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid_webhook_url") ||
    normalized.includes("http_400") ||
    normalized.includes("http_401") ||
    normalized.includes("http_403") ||
    normalized.includes("http_404") ||
    normalized.includes("invalid recipient") ||
    normalized.includes("recipient invalid") ||
    normalized.includes("unknown channel")
  );
}

function parseRetryPayload(metadata: Record<string, unknown> | null | undefined): RetryPayload | null {
  const payload = metadata?.retry_payload;
  if (!payload || typeof payload !== "object") return null;
  return payload as RetryPayload;
}

function getMaxAttempts(metadata: Record<string, unknown> | null | undefined, fallback: number): number {
  const raw = Number(metadata?.max_attempts ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(5, Math.trunc(raw)));
}

function isReminderNotification(notificationType: string | null | undefined, metadata: Record<string, unknown>) {
  return notificationType === "reminder_due" || typeof metadata.reminder_id === "string";
}

async function emitReminderDeliveryTelemetry(
  admin: AdminClient,
  input: {
    organizationId: string;
    notificationType?: string | null;
    metadata?: Record<string, unknown> | null;
    action:
      | "product.v9.reminder_delivered"
      | "product.v9.reminder_suppressed"
      | "product.v9.reminder_failed"
      | "product.v9.reminder_retried";
  }
) {
  const metadata = input.metadata ?? {};
  if (!isReminderNotification(input.notificationType, metadata)) return;
  await emitProductTelemetryEvent(admin, {
    organizationId: input.organizationId,
    userId: null,
    contractId: typeof metadata.contract_id === "string" ? metadata.contract_id : null,
    action: input.action,
    details: {
      notificationType: String(input.notificationType ?? "reminder_due"),
      reminderId: typeof metadata.reminder_id === "string" ? metadata.reminder_id : null,
    },
  });
}

async function runRetryPayload(payload: RetryPayload): Promise<{ error: Error | null }> {
  if (payload.kind === "reminder_due") {
    const result = await sendReminderEmail({
      to: payload.to,
      contractTitle: payload.contractTitle,
      fieldName: payload.fieldName,
      fieldValue: payload.fieldValue,
      daysUntil: payload.daysUntil,
      contractUrl: payload.contractUrl,
      sourceSnippet: payload.sourceSnippet ?? null,
    });
    return { error: result.error ?? null };
  }
  if (payload.kind === "saved_view_summary") {
    const result = await sendSavedViewSummaryEmail({
      to: payload.to,
      viewName: payload.viewName,
      appUrl: payload.appUrl,
      itemCount: payload.itemCount,
      workspacePath: payload.workspacePath,
      sampleRows: payload.sampleRows,
      openPixelUrl: payload.openPixelUrl ?? null,
      workspaceProductMode: payload.workspaceProductMode,
    });
    return { error: result.error ?? null };
  }
  if (payload.kind === "review_board_packet") {
    const result = await sendReviewBoardPacketEmail({
      to: payload.to,
      subject: payload.subject,
      htmlBody: payload.htmlBody,
    });
    return { error: result.error ?? null };
  }
  const webhook = validateOutboundHttpUrl(payload.webhookUrl);
  if (!webhook) return { error: new Error("invalid_webhook_url") };
  try {
    const response = await safeFetch(webhook.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `${payload.title}\n${payload.body}`,
        channel: payload.channel ?? undefined,
        username: payload.username ?? "Oblixa",
        metadata: payload.metadata ?? {},
      }),
    });
    if (!response.ok) return { error: new Error(`http_${response.status}`) };
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("slack_send_failed") };
  }
}

async function attemptDelivery(
  admin: AdminClient,
  deliveryId: string,
  opts?: { send?: () => Promise<{ error: Error | null | undefined }>; maxAttemptsFallback?: number }
): Promise<{
  delivered: boolean;
  error: string | null;
  skipped?: boolean;
  finalStatus?: "delivered" | "failed" | "retrying";
}> {
  const nowIso = new Date().toISOString();
  const leaseUntilIso = new Date(Date.now() + DELIVERY_LEASE_MS).toISOString();
  const { data: row } = await admin
    .from("notification_deliveries")
    .update({
      status: "retrying",
      next_attempt_at: leaseUntilIso,
    })
    .eq("id", deliveryId)
    .in("status", ["pending", "retrying"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .select("id, organization_id, notification_type, attempt_count, metadata")
    .maybeSingle();
  if (!row) return { delivered: false, error: "delivery_locked_or_not_due", skipped: true };

  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  const maxAttempts = getMaxAttempts(metadata, opts?.maxAttemptsFallback ?? 3);
  const nextAttempt = Math.max(1, Number(row.attempt_count ?? 0) + 1);

  let sendResult: { error: Error | null | undefined };
  if (opts?.send) {
    sendResult = await opts.send();
  } else {
    const retryPayload = parseRetryPayload(metadata);
    const validKinds: string[] = ["reminder_due", "saved_view_summary", "review_board_packet", "slack_workflow"];
    if (retryPayload && !validKinds.includes(retryPayload.kind)) {
      console.error(`[notification-delivery] invalid retry_payload kind: ${String(retryPayload.kind)}`);
      sendResult = { error: new Error("invalid_retry_payload_kind") };
    } else {
      sendResult = retryPayload
        ? await runRetryPayload(retryPayload)
        : { error: new Error("missing_retry_payload") };
    }
  }

  if (!sendResult.error) {
    const { error: updateErr } = await admin
      .from("notification_deliveries")
      .update({
        status: "delivered",
        attempt_count: nextAttempt,
        delivered_at: new Date().toISOString(),
        last_error: null,
        next_attempt_at: null,
      })
      .eq("id", deliveryId);
    if (updateErr) console.error("[notification-delivery] post-send delivered update failed:", updateErr.message);
    await emitReminderDeliveryTelemetry(admin, {
      organizationId: row.organization_id as string,
      notificationType: row.notification_type as string | null,
      metadata,
      action: "product.v9.reminder_delivered",
    });
    return { delivered: true, error: null, finalStatus: "delivered" };
  }

  const terminal = isTerminalDeliveryError(sendResult.error.message);
  const isFinal = terminal || nextAttempt >= maxAttempts;
  const backoffSeconds = Math.min(3600, Math.pow(2, nextAttempt) * 30);
  const { error: failUpdateErr } = await admin
    .from("notification_deliveries")
    .update({
      status: isFinal ? "failed" : "retrying",
      attempt_count: nextAttempt,
      last_error: `${terminal ? "[terminal] " : ""}${sendResult.error.message}`.slice(0, 500),
      next_attempt_at: isFinal
        ? null
        : new Date(Date.now() + backoffSeconds * 1000).toISOString(),
    })
    .eq("id", deliveryId);
  if (failUpdateErr) console.error("[notification-delivery] post-send failure update failed:", failUpdateErr.message);
  await emitReminderDeliveryTelemetry(admin, {
    organizationId: row.organization_id as string,
    notificationType: row.notification_type as string | null,
    metadata,
    action: isFinal ? "product.v9.reminder_failed" : "product.v9.reminder_retried",
  });
  return {
    delivered: false,
    error: sendResult.error.message,
    finalStatus: isFinal ? "failed" : "retrying",
  };
}

export async function deliverWithRetries(
  admin: AdminClient,
  input: {
    organizationId: string;
    channel: "email" | "slack";
    notificationType: string;
    recipient?: string | null;
    subject?: string | null;
    metadata?: Record<string, unknown>;
    maxAttempts?: number;
    retryPayload?: RetryPayload;
    send: () => Promise<{ error: Error | null | undefined }>;
  }
): Promise<{ delivered: boolean; error: string | null }> {
  const maxAttempts = Math.max(1, Math.min(5, input.maxAttempts ?? 3));
  const retryPayload = sanitizeRetryPayload(input.retryPayload ?? null);
  const metadata = sanitizeMetadata(input.metadata ?? {});
  const { data: row } = await admin
    .from("notification_deliveries")
    .insert({
      organization_id: input.organizationId,
      channel: input.channel,
      notification_type: input.notificationType,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        max_attempts: maxAttempts,
        retry_payload: retryPayload,
      },
    })
    .select("id")
    .maybeSingle();
  if (!row?.id) {
    const result = await input.send();
    return { delivered: !result.error, error: result.error?.message ?? null };
  }
  return attemptDelivery(admin, row.id, {
    send: input.send,
    maxAttemptsFallback: maxAttempts,
  });
}

export async function markNotificationSuppressed(
  admin: AdminClient,
  input: {
    organizationId: string;
    channel: "email" | "slack";
    notificationType: string;
    recipient?: string | null;
    subject?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await admin.from("notification_deliveries").insert({
    organization_id: input.organizationId,
    channel: input.channel,
    notification_type: input.notificationType,
    recipient: input.recipient ?? null,
    subject: input.subject ?? null,
    status: "suppressed",
    attempt_count: 0,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("[notification-delivery] suppressed insert failed:", error.message);
    return;
  }
  await emitReminderDeliveryTelemetry(admin, {
    organizationId: input.organizationId,
    notificationType: input.notificationType,
    metadata: input.metadata ?? {},
    action: "product.v9.reminder_suppressed",
  });
}

export async function processNotificationDeliveryRetries(
  admin: AdminClient,
  input?: { limit?: number }
): Promise<{
  scanned: number;
  delivered: number;
  failed: number;
  retried: number;
  skipped: number;
  organizationIds: string[];
}> {
  const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 50)));
  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("notification_deliveries")
    .select("id, status, organization_id")
    .in("status", ["pending", "retrying"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  let delivered = 0;
  let failed = 0;
  let retried = 0;
  let skipped = 0;
  const organizationIds = Array.from(
    new Set((rows ?? []).map((row) => String((row as { organization_id?: string }).organization_id ?? "")))
  ).filter(Boolean);
  const queue = [...(rows ?? [])];
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < queue.length) {
      const row = queue[idx++];
      const res = await attemptDelivery(admin, row.id);
      if (res.skipped) {
        skipped++;
        continue;
      }
      if (res.delivered) {
        delivered++;
      } else if (res.finalStatus === "failed") {
        failed++;
      } else {
        retried++;
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(RETRY_PROCESS_CONCURRENCY, queue.length) },
      () => worker()
    )
  );
  return { scanned: rows?.length ?? 0, delivered, failed, retried, skipped, organizationIds };
}
