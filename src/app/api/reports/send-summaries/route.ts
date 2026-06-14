import { getCanonicalServerBaseUrl } from "@/lib/app-url";
import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { handleReportSummariesCron } from "@/lib/reports/send-summaries-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function reportSummariesDependencyPreflight() {
  const appUrl = getCanonicalServerBaseUrl();
  if (!appUrl) {
    return {
      error: "Canonical app URL is not configured",
      code: "dependency_blocked",
      diagnostic_id: "report_summaries_canonical_app_url_missing",
      details: {
        dependency: "canonical_app_url",
        required_env: ["NEXT_PUBLIC_APP_URL", "APP_BASE_URL", "VERCEL_PROJECT_PRODUCTION_URL"],
        degraded_policy: "503 dependency_blocked",
      },
    };
  }
  if (!String(process.env.RESEND_API_KEY ?? "").trim()) {
    return {
      error: "Report email provider is not configured",
      code: "dependency_blocked",
      diagnostic_id: "report_summaries_resend_missing",
      details: {
        dependency: "email_provider",
        required_env: ["RESEND_API_KEY"],
        optional_env: ["EMAIL_FROM"],
        degraded_policy: "503 dependency_blocked",
      },
    };
  }
  return null;
}

export const GET = withCronRoute({
  route: "/api/reports/send-summaries",
  rateLimitKey: "cron:reports:send-summaries",
  rateLimit: RATE_LIMITS.reportsSummariesCron,
  dependencyPreflight: reportSummariesDependencyPreflight,
  handler: handleReportSummariesCron,
});
