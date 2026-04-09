import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";

/**
 * Inbound HTTP integrations (email, Slack, CRM-style callbacks) share a bearer token.
 * Optional per-route secrets override {@link INBOUND_AUTOMATION_TOKEN} for least privilege and rotation.
 *
 * Env resolution order per route:
 * - email: INBOUND_EMAIL_AUTOMATION_TOKEN → INBOUND_AUTOMATION_TOKEN
 * - slack: INBOUND_SLACK_AUTOMATION_TOKEN → INBOUND_AUTOMATION_TOKEN
 * - integrations_callback: INBOUND_INTEGRATIONS_CALLBACK_TOKEN → INBOUND_AUTOMATION_TOKEN
 */
export type InboundAutomationRoute = "email" | "slack" | "integrations_callback";

const ROUTE_ENV_KEYS: Record<InboundAutomationRoute, string> = {
  email: "INBOUND_EMAIL_AUTOMATION_TOKEN",
  slack: "INBOUND_SLACK_AUTOMATION_TOKEN",
  integrations_callback: "INBOUND_INTEGRATIONS_CALLBACK_TOKEN",
};

export function getInboundAutomationSecret(route: InboundAutomationRoute): string | null {
  const specific = process.env[ROUTE_ENV_KEYS[route]]?.trim();
  if (specific) return specific;
  const shared = process.env.INBOUND_AUTOMATION_TOKEN?.trim();
  return shared || null;
}

export function isInboundAutomationAuthorized(
  request: Request,
  route: InboundAutomationRoute
): boolean {
  const expected = getInboundAutomationSecret(route);
  if (!expected) return false;
  const auth = parseBearerToken(request.headers.get("authorization"));
  return !!auth && secureCompareUtf8(auth, expected);
}
