import { gateCronRequest } from "@/lib/security/cron-route-gate";

/** JSON 503 when CRON_SECRET missing; JSON 401 when caller auth invalid; null when OK. */
export function ensureCronAuthorized(request: Request) {
  return gateCronRequest(request);
}
