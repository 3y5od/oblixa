import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";

const PIXEL_GIF_BASE64 = "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";

function pixelResponse(status: number, retryAfterSec?: number) {
  const headers: Record<string, string> = {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store",
  };
  if (retryAfterSec != null) {
    headers["Retry-After"] = String(retryAfterSec);
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
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();
  await admin
    .from("report_run_recipients")
    .update({
      opened_at: nowIso,
      delivery_status: "opened",
    })
    .eq("engagement_token", token)
    .is("opened_at", null);

  return pixelResponse(200);
}
