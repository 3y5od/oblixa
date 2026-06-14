import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  handleReportPacksGenerateCron,
  runSingleReportPackGeneration,
} from "@/lib/reports/report-pack-generation-route";

export { runSingleReportPackGeneration };
export type { ReportPackGenerationResult } from "@/lib/reports/report-pack-generation-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/report-packs-generate",
  healthcheckRoute: "cron/v4/report-packs-generate",
  rateLimitKey: "cron:v4:report-packs-generate",
  rateLimit: RATE_LIMITS.v4ReportPacksCron,
  handler: handleReportPacksGenerateCron,
});
