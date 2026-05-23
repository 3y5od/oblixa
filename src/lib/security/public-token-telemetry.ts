import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";

export type PublicTokenSurface =
  | "external_action"
  | "calendar_feed"
  | "report_open"
  | "report_click";

export function recordPublicTokenMiss(input: {
  surface: PublicTokenSurface;
  route: string;
  tokenKey: string;
  ip: string;
  reason: "not_found" | "expired" | "revoked" | "invalid" | "malformed";
}): void {
  console.warn(
    `[security-event:public-token-miss] ${formatUnknownForServerLog({
      surface: input.surface,
      route: input.route,
      lookup_key: input.tokenKey,
      ip: input.ip,
      reason: input.reason,
    })}`
  );
}
