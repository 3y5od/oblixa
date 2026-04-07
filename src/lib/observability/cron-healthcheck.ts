export type CronHealthPayload = Record<string, unknown>;

/**
 * Best-effort cron heartbeat ping for external monitors.
 * This must never throw or block the cron handler result.
 */
export function pingCronHealthcheck(route: string, payload: CronHealthPayload): void {
  const url = process.env.CRON_HEALTHCHECK_URL?.trim();
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route, ...payload }),
  }).catch(() => {});
}

