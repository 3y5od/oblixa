import { createAdminClient } from "@/lib/supabase/server";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { deliverWithRetries, markNotificationSuppressed } from "@/lib/notification-delivery";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

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
      username: cfg.username ?? "ContractOps",
      metadata: input.metadata ?? {},
    },
    send: async () => {
      try {
        const response = await fetch(webhookUrl.toString(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: `${input.title}\n${input.body}`,
            channel: cfg.channel ?? undefined,
            username: cfg.username ?? "ContractOps",
            metadata: input.metadata ?? {},
          }),
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
