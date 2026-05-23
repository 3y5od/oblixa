import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { validatePreviousSecretExpiry } from "@/lib/security/rotating-secret";

/**
 * Inbound HTTP integrations (email, Slack, CRM-style callbacks) share a bearer token.
 * Optional per-route secrets override {@link INBOUND_AUTOMATION_TOKEN} for least privilege and rotation.
 *
 * Env resolution order per route:
 * - email: INBOUND_EMAIL_AUTOMATION_TOKEN → INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS → INBOUND_AUTOMATION_TOKEN → INBOUND_AUTOMATION_TOKEN_PREVIOUS
 * - slack: INBOUND_SLACK_AUTOMATION_TOKEN → INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS → INBOUND_AUTOMATION_TOKEN → INBOUND_AUTOMATION_TOKEN_PREVIOUS
 * - integrations_callback: INBOUND_INTEGRATIONS_CALLBACK_TOKEN → INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS → INBOUND_AUTOMATION_TOKEN → INBOUND_AUTOMATION_TOKEN_PREVIOUS
 */
export type InboundAutomationRoute = "email" | "slack" | "integrations_callback";

const ROUTE_ENV_KEYS: Record<InboundAutomationRoute, string> = {
  email: "INBOUND_EMAIL_AUTOMATION_TOKEN",
  slack: "INBOUND_SLACK_AUTOMATION_TOKEN",
  integrations_callback: "INBOUND_INTEGRATIONS_CALLBACK_TOKEN",
};

const ROUTE_PREVIOUS_ENV_KEYS: Record<InboundAutomationRoute, string> = {
  email: "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS",
  slack: "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS",
  integrations_callback: "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS",
};

const ROUTE_PREVIOUS_EXPIRES_AT_ENV_KEYS: Record<InboundAutomationRoute, string> = {
  email: "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
  slack: "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
  integrations_callback: "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS_EXPIRES_AT",
};

function compactSecrets(values: Array<string | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => !!value);
}

export function getInboundAutomationSecret(route: InboundAutomationRoute): string | null {
  return getInboundAutomationSecrets(route)[0] ?? null;
}

export function getInboundAutomationSecrets(route: InboundAutomationRoute): string[] {
  const specific = process.env[ROUTE_ENV_KEYS[route]];
  const previousSpecific = process.env[ROUTE_PREVIOUS_ENV_KEYS[route]];
  const previousSpecificStatus = validatePreviousSecretExpiry({
    previousSecret: previousSpecific,
    previousSecretExpiresAt: process.env[ROUTE_PREVIOUS_EXPIRES_AT_ENV_KEYS[route]],
  });
  const routeSpecificSecrets = compactSecrets([specific, previousSpecificStatus.ok ? previousSpecific : undefined]);
  if (routeSpecificSecrets.length > 0) return routeSpecificSecrets;
  const shared = process.env.INBOUND_AUTOMATION_TOKEN;
  const previousShared = process.env.INBOUND_AUTOMATION_TOKEN_PREVIOUS;
  const previousSharedStatus = validatePreviousSecretExpiry({
    previousSecret: previousShared,
    previousSecretExpiresAt: process.env.INBOUND_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT,
  });
  return compactSecrets([shared, previousSharedStatus.ok ? previousShared : undefined]);
}

export function isInboundAutomationAuthorized(
  request: Request,
  route: InboundAutomationRoute
): boolean {
  const expectedSecrets = getInboundAutomationSecrets(route);
  if (expectedSecrets.length === 0) return false;
  const auth = parseBearerToken(request.headers.get("authorization"));
  return !!auth && expectedSecrets.some((expected) => secureCompareUtf8(auth, expected));
}
