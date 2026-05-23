import { NextResponse } from "next/server";
import { getSweepCatalogStats } from "@/lib/debugging-sweep/catalog-index.server";
import { clientIpMatchesAllowlist, parseInternalDiagAllowlist } from "@/lib/debugging-sweep/internal-diag-allowlist";
import { getStubsRegisteredCount } from "@/lib/debugging-sweep/stubs/register-stubs";
import { deepRedactEmailLikeInUnknown } from "@/lib/observability/log-redaction";
import { createSweepLogger } from "@/lib/observability/logger";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { requireBearerSecret } from "@/lib/security/api-guards";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { createAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

const log = createSweepLogger("internal-debugging-sweep");
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;
const INTERNAL_DIAGNOSTIC_KIND = "OblixaDebuggingSweepReport" as const;
const SAFE_LOCALE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k]);
  }
  return out;
}

function negotiatedLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage?.trim()) return "en";
  const first = acceptLanguage.split(",")[0]?.trim().split(";")[0]?.trim().toLowerCase();
  if (!first) return "en";
  const candidate = first.slice(0, 12);
  return SAFE_LOCALE_RE.test(candidate) ? candidate : "en";
}

function sanitizeDiagnosticPayload(value: unknown): unknown {
  return sortKeysDeep(deepRedactEmailLikeInUnknown(value));
}

function diagnosticResponse(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = NO_STORE_HEADERS
): NextResponse {
  return new NextResponse(JSON.stringify(sanitizeDiagnosticPayload(body), null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export async function GET(request: Request) {
  const errors: { code: string; detail: string }[] = [];

  if (process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT !== "1") {
    return diagnosticResponse(404, { errors, kind: INTERNAL_DIAGNOSTIC_KIND, disabled: true });
  }

  const auth = requireBearerSecret(request, "OBLIXA_INTERNAL_DIAG_SECRET", {
    missingSecretResponse: () =>
      diagnosticResponse(404, { errors, kind: INTERNAL_DIAGNOSTIC_KIND, disabled: true }),
    unauthorizedResponse: () => {
      errors.push({ code: "UNAUTHORIZED", detail: "invalid or missing bearer" });
      return diagnosticResponse(403, { errors, kind: INTERNAL_DIAGNOSTIC_KIND });
    },
  });
  if (auth) return auth;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`internal-debugging-sweep:${ip}`, RATE_LIMITS.internalDebuggingSweep);
  if (!rl.ok) {
    errors.push({ code: "RATE_LIMITED", detail: "retry later" });
    return diagnosticResponse(429, { errors, kind: INTERNAL_DIAGNOSTIC_KIND }, {
      ...NO_STORE_HEADERS,
      "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
    });
  }

  const allow = parseInternalDiagAllowlist(process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST);
  if (!allow.ok) {
    errors.push({ code: allow.code, detail: "allowlist parse error" });
    log.error("internal diagnostics allowlist invalid");
    return diagnosticResponse(403, { errors, kind: INTERNAL_DIAGNOSTIC_KIND });
  }
  if (!clientIpMatchesAllowlist(ip, allow.rules)) {
    errors.push({ code: "FORBIDDEN_IP", detail: "not in allowlist" });
    return diagnosticResponse(403, { errors, kind: INTERNAL_DIAGNOSTIC_KIND });
  }

  const catalog = getSweepCatalogStats();
  const body = {
    errors,
    kind: INTERNAL_DIAGNOSTIC_KIND,
    catalogVersion: catalog.catalogVersion,
    invariantBuildId: catalog.invariantBuildId,
    negotiatedLocale: negotiatedLocale(request.headers.get("accept-language")),
    provenanceHash: catalog.provenanceHash,
    rowCount: catalog.rowCount,
    stubClassCount: catalog.stubClassCount,
    stubRegisteredCount: getStubsRegisteredCount(),
  };

  log.info("internal_debugging_sweep_success", {
    client_ip_prefix: ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip.split(".").slice(0, 2).join("."),
  });

  const auditOrgId = process.env.OBLIXA_INTERNAL_DIAG_AUDIT_ORG_ID?.trim() ?? "";
  if (auditOrgId && isUuid(auditOrgId)) {
    try {
      const admin = await createAdminClient();
      void recordSecurityAuditEvent(admin, {
        organizationId: auditOrgId,
        actorUserId: null,
        actorType: "system",
        action: "security.internal_debugging_sweep_success",
        targetType: "diagnostic",
        targetId: "internal_debugging_sweep",
        outcome: "success",
        safeMetadata: {
          stub_registered_count: getStubsRegisteredCount(),
          catalog_row_count: catalog.rowCount,
        },
      });
    } catch (err) {
      log.error("internal_debugging_sweep_audit_failed", { message: err instanceof Error ? err.message : String(err) });
    }
  }

  return diagnosticResponse(200, body);
}
