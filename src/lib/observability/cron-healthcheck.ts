import { validateOutboundHttpUrl } from "@/lib/security/url-policy";

export type CronHealthPayload = Record<string, unknown>;

/**
 * Best-effort cron heartbeat ping for external monitors.
 * This must never throw or block the cron handler result.
 */
export function pingCronHealthcheck(route: string, payload: CronHealthPayload): void {
  const raw = process.env.CRON_HEALTHCHECK_URL?.trim();
  if (!raw) return;
  const url = validateOutboundHttpUrl(raw);
  if (!url) return;
  void fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route, ...payload }),
  }).catch(() => {});
}

