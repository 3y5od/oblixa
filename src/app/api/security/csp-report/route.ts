import { NextResponse } from "next/server";
import { jsonBadRequest, jsonRateLimited, jsonUnsupportedMediaType } from "@/lib/http/problem";
import { getClientIpFromRequest, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { readTextBodyLimited } from "@/lib/security/read-json-body-limited";
import { formatCspReportForSecurityLog, normalizeCspReportBody } from "@/lib/security/csp-report";

const ROUTE = "/api/security/csp-report";
const CSP_REPORT_BODY_LIMIT = 16 * 1024;
const CSP_REPORT_CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json",
  "text/plain",
];
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
} as const;

function isSupportedCspReportContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.trim()) return true;
  return CSP_REPORT_CONTENT_TYPES.some((allowed) => contentType.includes(allowed));
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`csp-report:${ip}`, RATE_LIMITS.cspReport);
  if (!rl.ok) return jsonRateLimited(rl.retryAfterMs, ROUTE);

  if (!isSupportedCspReportContentType(request)) {
    return jsonUnsupportedMediaType(ROUTE, {
      expected: CSP_REPORT_CONTENT_TYPES.join(", "),
      received: (request.headers.get("content-type") ?? "").slice(0, 120),
    });
  }

  const raw = await readTextBodyLimited(request, CSP_REPORT_BODY_LIMIT);
  if (!raw.ok) return raw.response;

  let parsed: unknown;
  try {
    parsed = raw.text ? JSON.parse(raw.text) : null;
  } catch {
    return jsonBadRequest(ROUTE, { reason: "invalid_csp_report_json" });
  }

  const report = normalizeCspReportBody(parsed);
  if (!report) {
    return jsonBadRequest(ROUTE, { reason: "invalid_csp_report_shape" });
  }

  // Duplicate CSP reports are telemetry-only and bounded by body limits plus route rate limits.
  console.warn(`[security-event:csp-report] ${formatCspReportForSecurityLog(report)}`);
  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
