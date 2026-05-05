import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";

const PIXEL_GIF_BASE64 = "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";
const TRACKING_STATUS_HEADER = "x-oblixa-tracking-status";
const TRACKING_DIAGNOSTIC_ID_HEADER = "x-oblixa-diagnostic-id";

function pixelResponse(status: number, retryAfterSec?: number, diagnosticId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store",
  };
  if (retryAfterSec != null) {
    headers["Retry-After"] = String(retryAfterSec);
  }
  if (diagnosticId) {
    headers[TRACKING_STATUS_HEADER] = "degraded";
    headers[TRACKING_DIAGNOSTIC_ID_HEADER] = diagnosticId;
  }
  return new Response(Buffer.from(PIXEL_GIF_BASE64, "base64"), { status, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`report-track-open:${ip}`, RATE_LIMITS.reportTrackOpen);
  if (!rl.ok) {
    return pixelResponse(
      429,
      Math.max(1, Math.ceil(rl.retryAfterMs / 1000))
    );
  }
  const { token } = await params;
  if (!token || token.length < 8) {
    return pixelResponse(200);
  }
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  try {
    admin = await createAdminClient();
  } catch {
    return pixelResponse(200, undefined, "report_track_open_admin_unavailable");
  }
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("report_run_recipients")
    .update({
      opened_at: nowIso,
      delivery_status: "opened",
    })
    .eq("engagement_token", token)
    .is("opened_at", null);
  if (error) {
    return pixelResponse(200, undefined, "report_track_open_write_failed");
  }

  return pixelResponse(200);
}
