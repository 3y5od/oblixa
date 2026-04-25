/** §27.2 — surfaced on contract detail when date fields are not approved for reminder scheduling. */
export const REMINDER_INACTIVE_MISSING_APPROVED_DATES_COPY =
  "Reminder inactive due to missing approved dates." as const;

type ReminderDeliveryRow = {
  status: string | null;
  created_at: string | null;
  updated_at?: string | null;
  delivered_at?: string | null;
  next_attempt_at?: string | null;
  last_error?: string | null;
  metadata?: unknown;
};

type ReminderDeliveryState = {
  label: string;
  tone: "healthy" | "neutral" | "attention" | "risk";
  detail: string;
  timestamp: string | null;
};

function getMetadataReminderId(row: ReminderDeliveryRow): string | null {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  return typeof metadata?.reminder_id === "string" ? metadata.reminder_id : null;
}

function getMetadataSuppressionReason(row: ReminderDeliveryRow): string | null {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  return typeof metadata?.suppression_reason === "string" ? metadata.suppression_reason : null;
}

function normalizeDeliveryError(lastError: string | null | undefined): string | null {
  if (!lastError?.trim()) return null;
  return lastError.replace(/^\[terminal\]\s*/i, "").trim();
}

export function groupReminderDeliveriesByReminderId(rows: ReminderDeliveryRow[]): Record<string, ReminderDeliveryRow[]> {
  const grouped: Record<string, ReminderDeliveryRow[]> = {};
  for (const row of rows) {
    const reminderId = getMetadataReminderId(row);
    if (!reminderId) continue;
    grouped[reminderId] ??= [];
    grouped[reminderId].push(row);
  }
  for (const values of Object.values(grouped)) {
    values.sort((a, b) => {
      const aTime = new Date(a.updated_at ?? a.delivered_at ?? a.created_at ?? 0).getTime();
      const bTime = new Date(b.updated_at ?? b.delivered_at ?? b.created_at ?? 0).getTime();
      return bTime - aTime;
    });
  }
  return grouped;
}

export function getReminderDeliveryState(rows: ReminderDeliveryRow[]): ReminderDeliveryState {
  const latest = rows[0] ?? null;
  if (!latest) {
    return {
      label: "Scheduled",
      tone: "neutral",
      detail: "Queued from the approved date once delivery is due.",
      timestamp: null,
    };
  }

  const timestamp = latest.delivered_at ?? latest.updated_at ?? latest.created_at ?? null;
  switch (latest.status) {
    case "delivered":
      return {
        label: "Delivered",
        tone: "healthy",
        detail: "Reminder email was sent successfully.",
        timestamp,
      };
    case "suppressed":
      const suppressionReason = getMetadataSuppressionReason(latest);
      return {
        label: "Suppressed",
        tone: "attention",
        detail:
          suppressionReason === "missing_approved_dates"
            ? "Delivery was intentionally skipped because approved dates are still missing for this reminder."
            : suppressionReason === "deduped_recent_delivery"
              ? "Delivery was intentionally skipped because a recent reminder already covered this same action window."
              : "Delivery was intentionally skipped by current reminder settings or dedupe rules. Compare with Health → reminders for the latest delivery attempt and suppression reason.",
        timestamp,
      };
    case "failed":
      return {
        label: "Failed",
        tone: "risk",
        detail: normalizeDeliveryError(latest.last_error) || "Delivery failed and needs attention.",
        timestamp,
      };
    case "retrying":
      const retryAt = latest.next_attempt_at ? new Date(latest.next_attempt_at) : null;
      return {
        label: "Retrying",
        tone: "attention",
        detail:
          normalizeDeliveryError(latest.last_error) && retryAt
            ? `Delivery failed earlier (${normalizeDeliveryError(latest.last_error)}). Another retry is scheduled for ${retryAt.toISOString()}.`
            : normalizeDeliveryError(latest.last_error)
              ? `Delivery failed earlier (${normalizeDeliveryError(latest.last_error)}). Another retry is scheduled automatically.`
              : retryAt
                ? `Delivery failed earlier and will retry automatically at ${retryAt.toISOString()}.`
                : "Delivery failed earlier and will retry automatically.",
        timestamp,
      };
    case "pending":
      return {
        label: "Queued",
        tone: "attention",
        detail: "Delivery is waiting for the reminder worker.",
        timestamp,
      };
    default:
      return {
        label: "Scheduled",
        tone: "neutral",
        detail: "Reminder exists but no delivery attempt has been recorded yet.",
        timestamp,
      };
  }
}
