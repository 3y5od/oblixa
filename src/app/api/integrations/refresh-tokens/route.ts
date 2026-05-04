import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/security/token-crypto";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/integrations/refresh-tokens",
  healthcheckRoute: "integrations/refresh-tokens",
  rateLimitKey: "cron:integrations:refresh-tokens",
  rateLimit: RATE_LIMITS.integrationRefreshTokens,
  handler: async ({ admin }) => {
    const now = Date.now();
    const soonIso = new Date(now + 15 * 60 * 1000).toISOString();

    const { data: rows, error: rowsError } = await admin
      .from("integration_connections")
      .select("id, provider, refresh_token, token_expires_at, config_json")
      .eq("status", "connected")
      .not("refresh_token", "is", null)
      .lte("token_expires_at", soonIso)
      .limit(100);
    if (rowsError) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        pingReason: "load_failed",
        body: { error: "Failed to load integration connections" },
      };
    }

    let attempted = 0;
    let refreshed = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      const cfg = (row.config_json ?? {}) as {
        tokenRefreshUrl?: string;
        clientId?: string;
        clientSecret?: string;
        scope?: string;
      };
      if (!cfg.tokenRefreshUrl || !cfg.clientId || !cfg.clientSecret) {
        failed++;
        await admin
          .from("integration_connections")
          .update({ status: "error", last_error: "Missing refresh config in config_json" })
          .eq("id", row.id);
        continue;
      }
      const refreshUrl = validateOutboundHttpUrl(cfg.tokenRefreshUrl);
      if (!refreshUrl) {
        failed++;
        await admin
          .from("integration_connections")
          .update({ status: "error", last_error: "Invalid tokenRefreshUrl in config_json" })
          .eq("id", row.id);
        continue;
      }
      let refreshToken: string | null = null;
      try {
        refreshToken = decryptIntegrationToken(row.refresh_token as string | null);
      } catch {
        refreshToken = null;
      }
      if (!refreshToken) {
        failed++;
        await admin
          .from("integration_connections")
          .update({ status: "error", last_error: "Missing usable refresh_token" })
          .eq("id", row.id);
        continue;
      }
      attempted++;
      try {
        const res = await safeFetch(refreshUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            ...(cfg.scope ? { scope: cfg.scope } : {}),
          }).toString(),
          timeoutMs: 20_000,
        });
        if (!res.ok) {
          failed++;
          await admin
            .from("integration_connections")
            .update({ status: "error", last_error: `Token refresh failed: ${res.status}` })
            .eq("id", row.id);
          continue;
        }
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        if (!data.access_token) {
          failed++;
          await admin
            .from("integration_connections")
            .update({ status: "error", last_error: "No access_token returned from refresh" })
            .eq("id", row.id);
          continue;
        }
        const expiresIn = Math.max(60, Number(data.expires_in ?? 3600));
        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        await admin
          .from("integration_connections")
          .update({
            status: "connected",
            access_token: encryptIntegrationToken(data.access_token),
            refresh_token: encryptIntegrationToken(data.refresh_token ?? refreshToken),
            token_expires_at: tokenExpiresAt,
            last_synced_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", row.id);
        refreshed++;
      } catch (err) {
        failed++;
        await admin
          .from("integration_connections")
          .update({
            status: "error",
            last_error:
              err instanceof Error ? err.message.slice(0, 500) : "token_refresh_error",
          })
          .eq("id", row.id);
      }
    }

    return {
      partial: failed > 0,
      errorsCount: failed,
      body: {
        scanned: rows?.length ?? 0,
        attempted,
        refreshed,
        failed,
      },
    };
  },
});
