import { NextResponse } from "next/server";
import type { OrgRole } from "@/lib/types";
import { getApiAuthContext, type AuthContext } from "@/lib/v4/api-auth";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";

export const API_PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;

export type SessionApiContext = AuthContext;

/** JSON 401 when session + org membership is missing. */
export async function requireSessionApiContext(): Promise<
  SessionApiContext | NextResponse
> {
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: API_PRIVATE_NO_STORE_HEADERS });
  }
  return ctx;
}

/** JSON 401 when CRON_SECRET is missing or request is not authorized (Bearer or x-cron-secret). */
export function requireCronAuthorized(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: API_PRIVATE_NO_STORE_HEADERS });
  }
  if (!authorizeCronRequest(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: API_PRIVATE_NO_STORE_HEADERS });
  }
  return null;
}

/** JSON 401 when env secret missing or Authorization Bearer mismatch. */
export function requireBearerSecret(
  request: Request,
  envVarName: "EXTRACTION_WORKER_SECRET" | "OBLIXA_INTERNAL_DIAG_SECRET"
): NextResponse | null {
  const secret = process.env[envVarName]?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: API_PRIVATE_NO_STORE_HEADERS });
  }
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !secureCompareUtf8(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: API_PRIVATE_NO_STORE_HEADERS });
  }
  return null;
}

export function requireRoleAtLeast(ctx: SessionApiContext, minimum: OrgRole): NextResponse | null {
  const order: OrgRole[] = ["viewer", "editor", "admin"];
  const idx = (r: OrgRole) => order.indexOf(r);
  if (idx(ctx.role) < idx(minimum)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: API_PRIVATE_NO_STORE_HEADERS });
  }
  return null;
}
