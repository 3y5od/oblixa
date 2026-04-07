import { getOptionalServerEnv } from "@/lib/env/server";
import type { IntegrationConnection } from "@/lib/types";

type Provider =
  | "google_calendar"
  | "outlook_calendar"
  | "slack"
  | "email"
  | "crm";

export type OAuthProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
};

function envNameForProvider(provider: Provider): string {
  return provider.toUpperCase();
}

export function readOAuthProviderConfigFromEnv(
  provider: Provider
): OAuthProviderConfig | null {
  const stem = envNameForProvider(provider);
  const authorizeUrl = getOptionalServerEnv(`OAUTH_${stem}_AUTHORIZE_URL`);
  const tokenUrl = getOptionalServerEnv(`OAUTH_${stem}_TOKEN_URL`);
  const clientId = getOptionalServerEnv(`OAUTH_${stem}_CLIENT_ID`);
  const clientSecret = getOptionalServerEnv(`OAUTH_${stem}_CLIENT_SECRET`);
  const scope = getOptionalServerEnv(`OAUTH_${stem}_SCOPE`) ?? undefined;
  if (!authorizeUrl || !tokenUrl || !clientId || !clientSecret) {
    return null;
  }
  return { authorizeUrl, tokenUrl, clientId, clientSecret, scope };
}

export function readOAuthProviderConfigFromConnection(
  connection: Pick<IntegrationConnection, "config_json">
): OAuthProviderConfig | null {
  const cfg = (connection.config_json ?? {}) as Record<string, unknown>;
  const authorizeUrl =
    typeof cfg.authorizeUrl === "string" ? cfg.authorizeUrl.trim() : "";
  const tokenUrl = typeof cfg.tokenUrl === "string" ? cfg.tokenUrl.trim() : "";
  const clientId = typeof cfg.clientId === "string" ? cfg.clientId.trim() : "";
  const clientSecret =
    typeof cfg.clientSecret === "string" ? cfg.clientSecret.trim() : "";
  const scope = typeof cfg.scope === "string" ? cfg.scope.trim() : undefined;
  if (!authorizeUrl || !tokenUrl || !clientId || !clientSecret) {
    return null;
  }
  return { authorizeUrl, tokenUrl, clientId, clientSecret, scope };
}
