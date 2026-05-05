import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/security/token-crypto";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PersistAdmin = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

function appendRouteError(
  errors: Array<Record<string, unknown>>,
  input: {
    diagnosticId: string;
    phase: string;
    message: string;
    connectionId?: string;
    provider?: string;
    status?: number;
  }
) {
  errors.push({
    diagnostic_id: input.diagnosticId,
    phase: input.phase,
    message: input.message,
    ...(input.connectionId ? { connection_id: input.connectionId } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(typeof input.status === "number" ? { status: input.status } : {}),
  });
}

async function updateConnectionState(
  admin: PersistAdmin,
  connectionId: string,
  payload: Record<string, unknown>,
  errors: Array<Record<string, unknown>>,
  detail: { diagnosticId: string; message: string; provider?: string }
) {
  const { error } = await admin.from("integration_connections").update(payload).eq("id", connectionId);
  if (error) {
    appendRouteError(errors, {
      diagnosticId: detail.diagnosticId,
      phase: "persist",
      message: detail.message,
      connectionId,
      provider: detail.provider,
    });
    return false;
  }
  return true;
}

export const GET = withCronRoute({
  route: "/api/integrations/refresh-tokens",
  healthcheckRoute: "integrations/refresh-tokens",
  rateLimitKey: "cron:integrations:refresh-tokens",
  rateLimit: RATE_LIMITS.integrationRefreshTokens,
  handler: async ({ admin }) => {
    const now = Date.now();
    const soonIso = new Date(now + 15 * 60 * 1000).toISOString();
    const errors: Array<Record<string, unknown>> = [];
    let scanned = 0;
    let attempted = 0;
    let refreshed = 0;
    let failed = 0;
    const pageResult = await forEachSupabaseRangePage(
      (from, to) =>
        admin
          .from("integration_connections")
          .select("id, provider, refresh_token, token_expires_at, config_json")
          .eq("status", "connected")
          .not("refresh_token", "is", null)
          .lte("token_expires_at", soonIso)
          .range(from, to),
      async (chunk) => {
        scanned += chunk.length;
        for (const row of chunk) {
          const connectionId = String(row.id);
          const provider = String(row.provider ?? "unknown");
          const cfg = (row.config_json ?? {}) as {
            tokenRefreshUrl?: string;
            clientId?: string;
            clientSecret?: string;
            scope?: string;
          };
          if (!cfg.tokenRefreshUrl || !cfg.clientId || !cfg.clientSecret) {
            failed++;
            await updateConnectionState(
              admin,
              connectionId,
              { status: "error", last_error: "Missing refresh config in config_json" },
              errors,
              {
                diagnosticId: "integrations_refresh_config_write_failed",
                message: "Failed to persist missing refresh configuration state",
                provider,
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_refresh_config_missing",
              phase: "preflight",
              message: "Missing refresh config in config_json",
              connectionId,
              provider,
            });
            continue;
          }
          const refreshUrl = validateOutboundHttpUrl(cfg.tokenRefreshUrl);
          if (!refreshUrl) {
            failed++;
            await updateConnectionState(
              admin,
              connectionId,
              { status: "error", last_error: "Invalid tokenRefreshUrl in config_json" },
              errors,
              {
                diagnosticId: "integrations_refresh_config_write_failed",
                message: "Failed to persist invalid refresh URL state",
                provider,
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_refresh_url_invalid",
              phase: "preflight",
              message: "Invalid tokenRefreshUrl in config_json",
              connectionId,
              provider,
            });
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
            await updateConnectionState(
              admin,
              connectionId,
              { status: "error", last_error: "Missing usable refresh_token" },
              errors,
              {
                diagnosticId: "integrations_refresh_token_state_write_failed",
                message: "Failed to persist unusable refresh_token state",
                provider,
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_refresh_token_missing",
              phase: "preflight",
              message: "Missing usable refresh_token",
              connectionId,
              provider,
            });
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
              await updateConnectionState(
                admin,
                connectionId,
                { status: "error", last_error: `Token refresh failed: ${res.status}` },
                errors,
                {
                  diagnosticId: "integrations_refresh_http_failure_write_failed",
                  message: "Failed to persist token refresh HTTP failure",
                  provider,
                }
              );
              appendRouteError(errors, {
                diagnosticId: "integrations_refresh_failed",
                phase: "source_query",
                message: `Token refresh failed: ${res.status}`,
                connectionId,
                provider,
                status: res.status,
              });
              continue;
            }
            const data = (await res.json()) as {
              access_token?: string;
              refresh_token?: string;
              expires_in?: number;
            };
            if (!data.access_token) {
              failed++;
              await updateConnectionState(
                admin,
                connectionId,
                { status: "error", last_error: "No access_token returned from refresh" },
                errors,
                {
                  diagnosticId: "integrations_refresh_token_state_write_failed",
                  message: "Failed to persist missing access_token refresh state",
                  provider,
                }
              );
              appendRouteError(errors, {
                diagnosticId: "integrations_refresh_access_token_missing",
                phase: "source_query",
                message: "No access_token returned from refresh",
                connectionId,
                provider,
              });
              continue;
            }
            const expiresIn = Math.max(60, Number(data.expires_in ?? 3600));
            const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
            const wroteState = await updateConnectionState(
              admin,
              connectionId,
              {
                status: "connected",
                access_token: encryptIntegrationToken(data.access_token),
                refresh_token: encryptIntegrationToken(data.refresh_token ?? refreshToken),
                token_expires_at: tokenExpiresAt,
                last_synced_at: new Date().toISOString(),
                last_error: null,
              },
              errors,
              {
                diagnosticId: "integrations_refresh_success_write_failed",
                message: "Failed to persist refreshed token state",
                provider,
              }
            );
            if (wroteState) refreshed++;
          } catch (err) {
            failed++;
            await updateConnectionState(
              admin,
              connectionId,
              {
                status: "error",
                last_error:
                  err instanceof Error ? err.message.slice(0, 500) : "token_refresh_error",
              },
              errors,
              {
                diagnosticId: "integrations_refresh_exception_write_failed",
                message: "Failed to persist token refresh exception state",
                provider,
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_refresh_failed",
              phase: "source_query",
              message: err instanceof Error ? err.message.slice(0, 200) : "token_refresh_error",
              connectionId,
              provider,
            });
          }
        }
      },
      { pageSize: 100 }
    );

    if (pageResult.error && scanned === 0) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Failed to load integration connections",
          diagnostic_id: "integrations_refresh_connections_load_failed",
        },
      };
    }
    if (pageResult.error) {
      appendRouteError(errors, {
        diagnosticId: "integrations_refresh_connections_load_failed",
        phase: "source_query",
        message: pageResult.error.message,
      });
    }
    if (pageResult.stoppedByOffsetCap) {
      appendRouteError(errors, {
        diagnosticId: "integrations_refresh_connections_scan_truncated",
        phase: "source_query",
        message: "Refresh-token scan stopped at pagination offset cap",
      });
    }

    return {
      ok: failed === 0 && errors.length === 0,
      partial: failed > 0 || errors.length > 0,
      errorsCount: errors.length,
      body: {
        scanned,
        attempted,
        refreshed,
        failed,
        errors,
      },
    };
  },
});
