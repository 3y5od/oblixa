import { createAdminClient } from "@/lib/supabase/server";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { deliverWithRetries, markNotificationSuppressed } from "@/lib/notification-delivery";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

function escapeSlackMrkdwn(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*/g, "\u200b*")
    .replace(/_/g, "\u200b_");
}

/** Plain URL + optional Block Kit section with a single actionable link. */
function buildSlackWebhookBody(input: {
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  channel?: string;
  username: string;
}): Record<string, unknown> {
  const meta = input.metadata ?? {};
  const contractId = typeof meta.contract_id === "string" ? meta.contract_id : null;
  const deepPath =
    typeof meta.deep_link_path === "string" && meta.deep_link_path.startsWith("/")
      ? meta.deep_link_path
      : null;
  const base = getAppBaseUrlFromEnv();
  const openUrl = deepPath ? `${base}${deepPath}` : contractId ? `${base}/contracts/${contractId}` : null;

  const textFallback = openUrl
    ? `${input.title}\n${input.body}\nOpen in Oblixa: ${openUrl}`
    : `${input.title}\n${input.body}`;

  const payload: Record<string, unknown> = {
    text: textFallback,
    channel: input.channel ?? undefined,
    username: input.username,
  };

  if (openUrl) {
    payload.blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${escapeSlackMrkdwn(input.title)}*\n${escapeSlackMrkdwn(input.body)}\n<${openUrl}|Open in Oblixa>`,
        },
      },
    ];
  }

  return payload;
}

export async function sendSlackWorkflowNotification(
  admin: AdminClient,
  input: {
    organizationId: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const allowed = await isNotificationAllowed(admin, {
    organizationId: input.organizationId,
    channel: "slack",
    notificationType: "automation_rule",
  });
  if (!allowed) {
    await markNotificationSuppressed(admin, {
      organizationId: input.organizationId,
      channel: "slack",
      notificationType: "automation_rule",
      subject: input.title,
      metadata: input.metadata ?? {},
    });
    return { ok: false, reason: "suppressed_by_policy" };
  }
  const { data: connection } = await admin
    .from("integration_connections")
    .select("config_json, status")
    .eq("organization_id", input.organizationId)
    .eq("provider", "slack")
    .maybeSingle();
  if (!connection || connection.status !== "connected") {
    return { ok: false, reason: "slack_not_connected" };
  }
  const cfg = (connection.config_json ?? {}) as {
    webhookUrl?: string;
    channel?: string;
    username?: string;
  };
  if (!cfg.webhookUrl) return { ok: false, reason: "missing_webhook_url" };
  const webhookUrl = validateOutboundHttpUrl(cfg.webhookUrl);
  if (!webhookUrl) return { ok: false, reason: "invalid_webhook_url" };
  const delivery = await deliverWithRetries(admin, {
    organizationId: input.organizationId,
    channel: "slack",
    notificationType: "automation_rule",
    subject: input.title,
    metadata: input.metadata ?? {},
    maxAttempts: 3,
    retryPayload: {
      kind: "slack_workflow",
      webhookUrl: webhookUrl.toString(),
      title: input.title,
      body: input.body,
      channel: cfg.channel ?? null,
      username: cfg.username ?? "Oblixa",
      metadata: input.metadata ?? {},
    },
    send: async () => {
      try {
        const response = await safeFetch(webhookUrl.toString(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            buildSlackWebhookBody({
              title: input.title,
              body: input.body,
              metadata: input.metadata,
              channel: cfg.channel ?? undefined,
              username: cfg.username ?? "Oblixa",
            })
          ),
        });
        if (!response.ok) return { error: new Error(`http_${response.status}`) };
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error("slack_send_failed") };
      }
    },
  });
  if (!delivery.delivered) return { ok: false, reason: delivery.error ?? "slack_send_failed" };
  return { ok: true };
}

/** Posts a renewal outcome summary to the connected Slack webhook (same path as workflow notifications). */
export async function sendSlackRenewalDecisionSummary(
  admin: AdminClient,
  input: {
    organizationId: string;
    contractTitle: string;
    contractId: string;
    outcome: string;
    details?: string;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const body = [`Contract: ${input.contractTitle}`, `Outcome: ${input.outcome}`];
  if (input.details) body.push(input.details);
  return sendSlackWorkflowNotification(admin, {
    organizationId: input.organizationId,
    title: "Renewal decision summary",
    body: body.join("\n"),
    metadata: { contract_id: input.contractId, kind: "renewal_decision_summary" },
  });
}
