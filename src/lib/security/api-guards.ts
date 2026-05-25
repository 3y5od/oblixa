import { NextResponse } from "next/server";
import type { OrgRole } from "@/lib/types";
import { getApiAuthContext, type AuthContext } from "@/lib/contract-operations/api-auth";
import { gateCronRequest } from "@/lib/security/cron-route-gate";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";
import { jsonForbidden, jsonUnauthorized, PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";

export const API_PRIVATE_NO_STORE_HEADERS = PRIVATE_NO_STORE_HEADERS;

export type SessionApiContext = AuthContext;
type BearerSecretEnvVarName =
  | "EXTRACTION_WORKER_SECRET"
  | "OBLIXA_INTERNAL_DIAG_SECRET";

type RequireBearerSecretOptions = {
  missingSecretResponse?: (envVarName: BearerSecretEnvVarName) => NextResponse;
  unauthorizedResponse?: (envVarName: BearerSecretEnvVarName) => NextResponse;
};

/** JSON 401 when session + org membership is missing. */
export async function requireSessionApiContext(): Promise<
  SessionApiContext | NextResponse
> {
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonUnauthorized();
  }
  return ctx;
}

/** JSON 503 when CRON_SECRET missing; JSON 401 when not authorized (Bearer or x-cron-secret). */
export function requireCronAuthorized(request: Request): NextResponse | null {
  return gateCronRequest(request, { headers: API_PRIVATE_NO_STORE_HEADERS });
}

/** JSON 401 when env secret missing or Authorization Bearer mismatch. */
export function requireBearerSecret(
  request: Request,
  envVarName: BearerSecretEnvVarName,
  options: RequireBearerSecretOptions = {}
): NextResponse | null {
  const secret = process.env[envVarName]?.trim();
  if (!secret) {
    return (
      options.missingSecretResponse?.(envVarName) ??
      jsonUnauthorized()
    );
  }
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !secureCompareUtf8(token, secret)) {
    return (
      options.unauthorizedResponse?.(envVarName) ??
      jsonUnauthorized()
    );
  }
  return null;
}

export function requireRoleAtLeast(ctx: SessionApiContext, minimum: OrgRole): NextResponse | null {
  const order: OrgRole[] = ["viewer", "editor", "admin"];
  const idx = (r: OrgRole) => order.indexOf(r);
  if (idx(ctx.role) < idx(minimum)) {
    return jsonForbidden();
  }
  return null;
}
