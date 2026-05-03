import { jsonOk } from "@/lib/http/problem";
import { jsonWithRouteId } from "@/lib/observability/api-route-instrumentation";

export const dynamic = "force-dynamic";

const ROUTE_ID = "/api/health";

export async function GET() {
  return jsonWithRouteId(
    ROUTE_ID,
    {
      ok: true,
      route: ROUTE_ID,
      status: "ok",
      runtime: "nodejs",
      release:
        process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
        process.env.SENTRY_RELEASE ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        null,
      checked_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
      },
    }
  );
}

export async function HEAD() {
  const res = jsonOk(
    { ok: true, route: ROUTE_ID },
    {
      headers: {
        "x-oblixa-route-id": ROUTE_ID,
      },
    }
  );
  return new Response(null, { status: res.status, headers: res.headers });
}
