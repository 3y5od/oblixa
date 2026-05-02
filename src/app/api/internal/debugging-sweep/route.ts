import { NextResponse } from "next/server";
import { getSweepCatalogStats } from "@/lib/debugging-sweep/catalog-index.server";
import { clientIpMatchesAllowlist, parseInternalDiagAllowlist } from "@/lib/debugging-sweep/internal-diag-allowlist";
import { getStubsRegisteredCount } from "@/lib/debugging-sweep/stubs/register-stubs";
import { createSweepLogger } from "@/lib/observability/logger";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { createAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

const log = createSweepLogger("internal-debugging-sweep");

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
  return (first && first.slice(0, 8)) || "en";
}

export async function GET(request: Request) {
  const errors: { code: string; detail: string }[] = [];

  if (process.env.OBLIXA_DEBUGGING_SWEEP_ENDPOINT !== "1") {
    return NextResponse.json(sortKeysDeep({ errors, kind: "OblixaDebuggingSweepReport", disabled: true }), {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
    });
  }

  const secret = process.env.OBLIXA_INTERNAL_DIAG_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(sortKeysDeep({ errors, kind: "OblixaDebuggingSweepReport", disabled: true }), {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
    });
  }

  const bearer = parseBearerToken(request.headers.get("authorization"));
  if (!bearer || !secureCompareUtf8(bearer, secret)) {
    errors.push({ code: "UNAUTHORIZED", detail: "invalid or missing bearer" });
    return NextResponse.json(sortKeysDeep({ errors, kind: "OblixaDebuggingSweepReport" }), {
      status: 403,
      headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
    });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`internal-debugging-sweep:${ip}`, RATE_LIMITS.internalDebuggingSweep);
  if (!rl.ok) {
    errors.push({ code: "RATE_LIMITED", detail: "retry later" });
    return NextResponse.json(sortKeysDeep({ errors, kind: "OblixaDebuggingSweepReport" }), {
      status: 429,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
      },
    });
  }

  const allow = parseInternalDiagAllowlist(process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST);
  if (!allow.ok) {
    errors.push({ code: allow.code, detail: "allowlist parse error" });
    log.error("internal diagnostics allowlist invalid");
    return NextResponse.json(sortKeysDeep({ errors, kind: "OblixaDebuggingSweepReport" }), {
      status: 403,
      headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
    });
  }
  if (!clientIpMatchesAllowlist(ip, allow.rules)) {
    errors.push({ code: "FORBIDDEN_IP", detail: "not in allowlist" });
    return NextResponse.json(sortKeysDeep({ errors, kind: "OblixaDebuggingSweepReport" }), {
      status: 403,
      headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
    });
  }

  const catalog = getSweepCatalogStats();
  const body = {
    errors,
    kind: "OblixaDebuggingSweepReport" as const,
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

  return new NextResponse(JSON.stringify(sortKeysDeep(body), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}
