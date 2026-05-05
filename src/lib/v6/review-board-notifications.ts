import type { AdminClient } from "@/lib/v6/service";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { deliverWithRetries, markNotificationSuppressed } from "@/lib/notification-delivery";
import { sendReviewBoardPacketEmail } from "@/lib/email";
import { getCanonicalServerBaseUrl } from "@/lib/app-url";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { type BatchItemError } from "@/lib/route-runtime-contract";

function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function buildPacketSummaryLines(summary: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const keys = [
    "open_findings",
    "open_decisions",
    "active_campaigns",
    "campaigns_with_drift_signal",
    "lowest_scorecards",
  ] as const;
  for (const k of keys) {
    const v = summary[k];
    if (v === undefined || v === null) continue;
    if (k === "lowest_scorecards" && Array.isArray(v)) {
      lines.push(`${k}: ${v.length} row(s) in packet`);
    } else {
      lines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v)}`);
    }
  }
  if (lines.length === 0) lines.push("See Oblixa for the full packet.");
  return lines;
}

function deliveryError(scope: string, diagnosticId: string, message: string, phase: BatchItemError["phase"] = "notify") {
  return { scope, phase, diagnostic_id: diagnosticId, message } satisfies BatchItemError;
}

/**
 * Notify board subscribers when a run is generated (v6.md §9.8 subscriptions + exports).
 * Email: `{ "email": "a@b.com", "channel": "email" }` or `{ "email": "a@b.com" }`.
 * Slack: `{ "channel": "slack", "webhookUrl": "https://hooks.slack.com/...", "slack_channel": "#assurance" }`.
 */
export async function deliverReviewBoardRunNotifications(
  admin: AdminClient,
  orgId: string,
  opts: {
    boardId: string;
    boardName: string;
    runId: string;
    subscriptions: unknown;
    packetSummary: Record<string, unknown>;
    source: "cron" | "api";
  }
): Promise<{ attempted: number; delivered: number; errors: BatchItemError[] }> {
  const appUrl = getCanonicalServerBaseUrl();
  const errors: BatchItemError[] = [];
  if (!appUrl) {
    errors.push(
      deliveryError(
        opts.boardId,
        "v6_review_board_notification_canonical_app_url_missing",
        "Canonical app URL is not configured",
        "dependency_preflight"
      )
    );
    return { attempted: 0, delivered: 0, errors };
  }

  const reviewUrl = `${appUrl}/assurance/review-boards`;
  const exportUrl = `${appUrl}/api/review-boards/runs/${encodeURIComponent(opts.runId)}?format=json`;
  const subs = Array.isArray(opts.subscriptions) ? opts.subscriptions : [];
  let attempted = 0;
  let delivered = 0;

  const summaryLines = buildPacketSummaryLines(opts.packetSummary);
  const plainBody = [
    `Board: ${opts.boardName}`,
    `Run ID: ${opts.runId}`,
    "",
    ...summaryLines,
    "",
    `Open review boards: ${reviewUrl}`,
    `Export JSON: ${exportUrl}`,
  ].join("\n");

  for (const raw of subs) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const channel = String(s.channel ?? "email").toLowerCase();

    if (channel === "email") {
      const to = String(s.email ?? "").trim();
      if (!isLikelyEmail(to)) continue;
      attempted += 1;
      const allowed = await isNotificationAllowed(admin, {
        organizationId: orgId,
        channel: "email",
        notificationType: "review_board_packet",
      });
      if (!allowed) {
        await markNotificationSuppressed(admin, {
          organizationId: orgId,
          channel: "email",
          notificationType: "review_board_packet",
          recipient: to,
          subject: `Assurance review board: ${opts.boardName}`,
          metadata: { review_board_id: opts.boardId, review_board_run_id: opts.runId },
        });
        continue;
      }

      const subject = `Assurance review board: ${opts.boardName}`;
      const htmlBody = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#111827;font-size:17px;">Review board packet ready</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.5;"><strong>${escapeHtml(
          opts.boardName
        )}</strong> · run <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${escapeHtml(
          opts.runId
        )}</code></p>
        <ul style="color:#374151;font-size:13px;line-height:1.5;">
          ${summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
        <p style="margin-top:18px;">
          <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:10px 18px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Open Assurance → Review boards</a>
        </p>
        <p style="margin-top:12px;font-size:12px;color:#6b7280;">
          <a href="${escapeHtml(exportUrl)}" style="color:#2563eb;">Download full run (JSON)</a>
        </p>
        <p style="margin-top:16px;font-size:11px;color:#9ca3af;">Source: ${escapeHtml(opts.source)}</p>
      </div>`;

      const result = await deliverWithRetries(admin, {
        organizationId: orgId,
        channel: "email",
        notificationType: "review_board_packet",
        recipient: to,
        subject,
        metadata: {
          review_board_id: opts.boardId,
          review_board_run_id: opts.runId,
          source: opts.source,
        },
        maxAttempts: 3,
        retryPayload: {
          kind: "review_board_packet",
          to,
          subject,
          htmlBody,
        },
        send: () => sendReviewBoardPacketEmail({ to, subject, htmlBody }),
      });
      if (result.delivered) delivered += 1;
      else {
        errors.push(
          deliveryError(
            `${opts.boardId}:${to}`,
            "v6_review_board_email_delivery_failed",
            result.error ?? "review board email delivery failed"
          )
        );
      }
      continue;
    }

    if (channel === "slack") {
      const webhookRaw = String(s.webhookUrl ?? s.webhook_url ?? "").trim();
      const webhook = validateOutboundHttpUrl(webhookRaw);
      if (!webhook) {
        errors.push(
          deliveryError(
            `${opts.boardId}:slack`,
            "v6_review_board_slack_webhook_invalid",
            "invalid slack webhook URL",
            "transform"
          )
        );
        continue;
      }
      attempted += 1;
      const slackAllowed = await isNotificationAllowed(admin, {
        organizationId: orgId,
        channel: "slack",
        notificationType: "review_board_slack",
      });
      if (!slackAllowed) {
        await markNotificationSuppressed(admin, {
          organizationId: orgId,
          channel: "slack",
          notificationType: "review_board_slack",
          subject: `Review board packet: ${opts.boardName}`,
          metadata: { review_board_id: opts.boardId, review_board_run_id: opts.runId },
        });
        continue;
      }

      const slackChannel = s.slack_channel != null ? String(s.slack_channel) : null;
      const title = `Review board packet: ${opts.boardName}`;
      const result = await deliverWithRetries(admin, {
        organizationId: orgId,
        channel: "slack",
        notificationType: "review_board_slack",
        subject: title,
        metadata: {
          review_board_id: opts.boardId,
          review_board_run_id: opts.runId,
          source: opts.source,
        },
        maxAttempts: 3,
        retryPayload: {
          kind: "slack_workflow",
          webhookUrl: webhook.toString(),
          title,
          body: plainBody,
          channel: slackChannel,
          username: "Oblixa Assurance",
          metadata: { run_id: opts.runId },
        },
        send: async () => {
          try {
            const response = await safeFetch(webhook.toString(), {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                text: `${title}\n${plainBody}`,
                channel: slackChannel ?? undefined,
                username: "Oblixa Assurance",
              }),
            });
            if (!response.ok) return { error: new Error(`http_${response.status}`) };
            return { error: null };
          } catch (e) {
            return { error: e instanceof Error ? e : new Error("slack_send_failed") };
          }
        },
      });
      if (result.delivered) delivered += 1;
      else {
        errors.push(
          deliveryError(
            `${opts.boardId}:${webhook.host}`,
            "v6_review_board_slack_delivery_failed",
            result.error ?? "review board slack delivery failed"
          )
        );
      }
      continue;
    }

    errors.push(
      deliveryError(
        `${opts.boardId}:subscription`,
        "v6_review_board_notification_channel_invalid",
        `unsupported review board notification channel: ${channel}`,
        "transform"
      )
    );
  }

  if (delivered > 0) {
    await incrementV6QualityCounter(admin, orgId, "review_board_notifications_delivered_total", delivered).catch(
      () => undefined
    );
  }
  return { attempted, delivered, errors };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}